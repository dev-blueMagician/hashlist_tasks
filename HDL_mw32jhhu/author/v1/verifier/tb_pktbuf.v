`timescale 1ns/1ps
// Withheld bench for pktbuf on board rev C.
//
// The SRAM model is the NW61P1024 as its datasheet describes it, with LAT
// strapped high (ECO-117): read data is captured at command edge + 3, write
// data is sampled at command edge + 1, and the array location is written at
// command edge + 2, so a read of that address at edge + 1 or + 2 returns the
// previous contents. Unused read cycles return random data.
//
// Each scenario starts from a reset and drives random traffic from +seed.
// The bench keeps its own model of what must come out and compares every
// output beat. It prints CHECK <nonce> <name> PASS|FAIL <why>, then DONE.
module tb_pktbuf #(
    parameter DW = 32,
    parameter AW = 10
);
    localparam CAP    = 1 << AW;
    localparam EQ     = 4096;                 // expected-beat ring
    localparam MAXLEN = (CAP < 40) ? CAP : 40;
    localparam LRLEN  = (CAP < 32) ? CAP : 32;
    localparam NCHK   = 8;
    localparam C_RESET = 0, C_DROP = 1, C_SFLONG = 2, C_SFSHORT = 3,
               C_CT = 4, C_LINE = 5, C_BP = 6, C_MIXED = 7;

    // ------------------------------------------------------------------
    // DUT
    // ------------------------------------------------------------------
    reg clk = 1'b0;
    always #5 clk = ~clk;

    reg           rst_n     = 1'b0;
    reg           cfg_ct    = 1'b0;
    reg           in_valid  = 1'b0;
    reg  [DW-1:0] in_data   = {DW{1'b0}};
    reg           in_last   = 1'b0;
    reg           in_err    = 1'b0;
    reg           out_ready = 1'b0;
    wire          in_ready, out_valid, out_last, out_err;
    wire [DW-1:0] out_data;
    wire [15:0]   drop_count;
    wire          sram_ce_n, sram_we_n;
    wire [AW-1:0] sram_addr;
    wire [DW-1:0] sram_wdata;
    reg  [DW-1:0] sram_rdata;

    pktbuf #(.DW(DW), .AW(AW)) dut (
        .clk(clk), .rst_n(rst_n), .cfg_cut_through(cfg_ct),
        .in_valid(in_valid), .in_ready(in_ready), .in_data(in_data),
        .in_last(in_last), .in_err(in_err),
        .out_valid(out_valid), .out_ready(out_ready), .out_data(out_data),
        .out_last(out_last), .out_err(out_err),
        .drop_count(drop_count),
        .sram_ce_n(sram_ce_n), .sram_we_n(sram_we_n), .sram_addr(sram_addr),
        .sram_wdata(sram_wdata), .sram_rdata(sram_rdata)
    );

    // ------------------------------------------------------------------
    // NW61P1024 model, LAT = H
    // ------------------------------------------------------------------
    reg [DW-1:0] mem [0:CAP-1];
    reg          w1_v = 1'b0, w2_v = 1'b0;
    reg [AW-1:0] w1_a, w2_a;
    reg [DW-1:0] w2_d;
    reg          r1_v = 1'b0, r2_v = 1'b0;
    reg [DW-1:0] r1_d, r2_d;
    integer      mseed;

    always @(posedge clk) begin
        // write: command at edge n, data at n+1, array written at n+2
        w1_v <= (sram_ce_n === 1'b0) && (sram_we_n === 1'b0);
        w1_a <= sram_addr;
        w2_v <= w1_v;
        w2_a <= w1_a;
        w2_d <= sram_wdata;
        if (w2_v)
            mem[w2_a] <= w2_d;
        // read: array read at edge n, data on the pins for capture at n+3
        r1_v <= (sram_ce_n === 1'b0) && (sram_we_n === 1'b1);
        r1_d <= mem[sram_addr];
        r2_v <= r1_v;
        r2_d <= r1_d;
        sram_rdata <= r2_v ? r2_d : $random(mseed);
    end

    // ------------------------------------------------------------------
    // Stimulus state and expected output
    // ------------------------------------------------------------------
    reg  [63:0]   nonce;
    integer       seed;
    integer       cyc;            // cycles since the scenario's reset

    reg  [DW-1:0] eq_d [0:EQ-1];
    reg           eq_l [0:EQ-1];
    reg           eq_e [0:EQ-1];
    integer       eq_wp, eq_rp;   // free-running counts
    reg  [DW-1:0] st_d [0:63];    // beats of the packet being sent (store-and-forward)
    integer       st_n;

    integer       pk_left, bt_left;
    reg           pk_err;
    integer       drops_exp;
    integer       p_in, p_out, p_err, p_stall, l_min, l_max, stall_left;
    reg           gen_on;
    reg           in_taken;

    integer       cur;            // check being exercised
    integer       nfail [0:NCHK-1];
    reg [8*120-1:0] why  [0:NCHK-1];
    reg [8*120-1:0] msg;

    // line-rate measurements
    integer       lr_in_n, lr_c0, lr_c1, lr_out_n, lr_c2, lr_c3, lr_gap;

    integer       i, k, ph;

    function integer rnd(input integer n);
        begin
            rnd = ($random(seed) & 32'h7fffffff) % n;
        end
    endfunction

    task fail(input integer c);
        begin
            if (nfail[c] == 0)
                why[c] = msg;
            nfail[c] = nfail[c] + 1;
        end
    endtask

    // ------------------------------------------------------------------
    // One clock cycle: drive inputs after the falling edge, then look at
    // the outputs; a handshake seen here happens at the next rising edge.
    // ------------------------------------------------------------------
    task step;
        reg in_hs, out_hs;
        begin
            @(negedge clk);
            if (in_taken) begin
                in_valid = 1'b0;
                in_taken = 1'b0;
            end
            // ingress: hold a beat until it is taken
            if (!in_valid && gen_on && (bt_left > 0 || pk_left > 0) && rnd(100) < p_in) begin
                if (bt_left == 0) begin
                    bt_left = l_min + rnd(l_max - l_min + 1);
                    pk_err  = (rnd(100) < p_err);
                    st_n    = 0;
                end
                in_valid = 1'b1;
                in_data  = $random(seed);
                in_last  = (bt_left == 1);
                in_err   = (bt_left == 1) ? pk_err : rnd(2);
            end
            // egress
            if (stall_left > 0) begin
                out_ready  = 1'b0;
                stall_left = stall_left - 1;
            end else if (p_stall > 0 && rnd(1000) < p_stall) begin
                out_ready  = 1'b0;
                stall_left = 4 + rnd(16);
            end else begin
                out_ready = (rnd(100) < p_out);
            end
            #1;
            if (out_valid !== 1'b0 && out_valid !== 1'b1) begin
                $sformat(msg, "out_valid is %b at cycle %0d", out_valid, cyc); fail(cur);
            end
            if (in_ready !== 1'b0 && in_ready !== 1'b1) begin
                $sformat(msg, "in_ready is %b at cycle %0d", in_ready, cyc); fail(cur);
            end
            in_hs  = in_valid && (in_ready === 1'b1);
            out_hs = (out_valid === 1'b1) && out_ready;

            if (out_hs) begin
                if (eq_rp == eq_wp) begin
                    $sformat(msg, "output beat %h at cycle %0d with nothing left to send", out_data, cyc);
                    fail(cur);
                end else begin
                    k = eq_rp % EQ;
                    if (out_data !== eq_d[k] || out_last !== eq_l[k] || out_err !== eq_e[k]) begin
                        $sformat(msg, "output beat %0d: got data %h last %b err %b, expected %h %b %b (cycle %0d)",
                                 eq_rp, out_data, out_last, out_err, eq_d[k], eq_l[k], eq_e[k], cyc);
                        fail(cur);
                    end
                    eq_rp = eq_rp + 1;
                end
                if (lr_out_n == 0) lr_c2 = cyc;
                if (lr_out_n > 0 && cyc != lr_c3 + 1) lr_gap = lr_gap + 1;
                lr_c3    = cyc;
                lr_out_n = lr_out_n + 1;
            end

            if (in_hs) begin
                if (lr_in_n == 0) lr_c0 = cyc;
                lr_c1   = cyc;
                lr_in_n = lr_in_n + 1;
                if (cfg_ct) begin
                    k = eq_wp % EQ;
                    eq_d[k] = in_data;
                    eq_l[k] = in_last;
                    eq_e[k] = in_last && in_err;
                    eq_wp   = eq_wp + 1;
                end else begin
                    st_d[st_n] = in_data;
                    st_n = st_n + 1;
                    if (in_last) begin
                        if (in_err) begin
                            drops_exp = drops_exp + 1;
                        end else begin
                            for (i = 0; i < st_n; i = i + 1) begin
                                k = eq_wp % EQ;
                                eq_d[k] = st_d[i];
                                eq_l[k] = (i == st_n - 1);
                                eq_e[k] = 1'b0;
                                eq_wp   = eq_wp + 1;
                            end
                        end
                        st_n = 0;
                    end
                end
                bt_left = bt_left - 1;
                if (bt_left == 0)
                    pk_left = pk_left - 1;
                in_taken = 1'b1;      // lowered after the edge that takes it
            end
            cyc = cyc + 1;
        end
    endtask

    // Reset, then watch the idle block (must check reset_idle).
    task do_reset(input ct);
        begin
            @(negedge clk);
            rst_n = 1'b0;
            in_valid = 1'b0; in_taken = 1'b0; in_last = 1'b0; in_err = 1'b0; out_ready = 1'b0;
            cfg_ct = ct;
            gen_on = 1'b0; pk_left = 0; bt_left = 0; stall_left = 0; p_stall = 0;
            eq_wp = 0; eq_rp = 0; st_n = 0; drops_exp = 0;
            lr_in_n = 0; lr_out_n = 0; lr_gap = 0;
            repeat (3) @(negedge clk);
            rst_n = 1'b1;
            cyc = 0;
            for (i = 0; i < 16; i = i + 1) begin
                @(negedge clk);
                #1;
                if (out_valid !== 1'b0) begin
                    $sformat(msg, "out_valid is %b %0d cycles after reset", out_valid, i); fail(C_RESET);
                end
                if (sram_ce_n !== 1'b1) begin
                    $sformat(msg, "SRAM command (ce_n %b) %0d cycles after reset with no traffic", sram_ce_n, i); fail(C_RESET);
                end
                if (drop_count !== 16'd0) begin
                    $sformat(msg, "drop_count is %h after reset", drop_count); fail(C_RESET);
                end
                if (i >= 4 && in_ready !== 1'b1) begin
                    $sformat(msg, "in_ready is %b %0d cycles after reset", in_ready, i); fail(C_RESET);
                end
            end
            out_ready = 1'b1;
        end
    endtask

    // Send npk packets with the given policy, then drain. limit bounds the cycles.
    task traffic(input integer npk, input integer lmin, input integer lmax, input integer perr,
                 input integer pin, input integer pout, input integer pstall, input integer limit);
        integer t0, j;
        begin
            l_min = lmin; l_max = (lmax > MAXLEN) ? MAXLEN : lmax;
            if (l_min > l_max) l_min = l_max;
            p_err = perr; p_in = pin; p_out = pout; p_stall = pstall;
            pk_left = npk; bt_left = 0; gen_on = 1'b1;
            t0 = cyc;
            while ((pk_left > 0 || (in_valid && !in_taken)) && cyc - t0 < limit)
                step;
            gen_on = 1'b0; p_out = 100; p_stall = 0; stall_left = 0;
            while (eq_rp != eq_wp && cyc - t0 < limit)
                step;
            if (pk_left > 0 || (in_valid && !in_taken) || eq_rp != eq_wp) begin
                $sformat(msg, "stalled: %0d packets not taken, %0d beats not delivered after %0d cycles",
                         pk_left, eq_wp - eq_rp, cyc - t0);
                fail(cur);
                // do not let a stuck design keep the bench from finishing
                in_valid = 1'b0; in_taken = 1'b0; pk_left = 0; bt_left = 0;
            end
            for (j = 0; j < 20; j = j + 1)
                step;              // anything that comes out now is extra
        end
    endtask

    task show(input integer c, input [8*16-1:0] name);
        begin
            if (nfail[c] == 0)
                $display("CHECK %h %0s PASS", nonce, name);
            else
                $display("CHECK %h %0s FAIL %0d errors, first: %0s", nonce, name, nfail[c], why[c]);
        end
    endtask

    // ------------------------------------------------------------------
    // Scenarios
    // ------------------------------------------------------------------
    initial begin
        if (!$value$plusargs("nonce=%h", nonce)) nonce = 64'h0;
        if (!$value$plusargs("seed=%d", seed))   seed  = 1;
        mseed = seed ^ 32'h5a5a1234;
        for (i = 0; i < NCHK; i = i + 1) begin
            nfail[i] = 0;
            why[i]   = "";
        end
        for (i = 0; i < CAP; i = i + 1)
            mem[i] = $random(mseed);
        msg = "";

        // store-and-forward, long packets, no backpressure
        cur = C_SFLONG; do_reset(1'b0);
        traffic(50, 4, 40, 0, 70, 100, 0, 20000);

        // store-and-forward, packets of 1 to 3 words
        cur = C_SFSHORT; do_reset(1'b0);
        traffic(150, 1, 3, 0, 60, 100, 0, 20000);
        traffic(150, 1, 3, 0, 100, 100, 0, 20000);

        // cut-through, errors forwarded on the last beat
        cur = C_CT; do_reset(1'b1);
        traffic(40, 1, 30, 20, 60, 100, 0, 20000);
        traffic(40, 1, 30, 20, 100, 100, 0, 20000);

        // line rate: a full packet into an empty buffer, then streamed out
        cur = C_LINE; do_reset(1'b0);
        for (ph = 0; ph < 4; ph = ph + 1) begin
            lr_in_n = 0; lr_out_n = 0; lr_gap = 0;
            traffic(1, LRLEN, LRLEN, 0, 100, 100, 0, 2000);
            if (lr_in_n != LRLEN || lr_c1 - lr_c0 != LRLEN - 1) begin
                $sformat(msg, "packet %0d: %0d beats took %0d cycles to enter", ph, lr_in_n, lr_c1 - lr_c0 + 1);
                fail(C_LINE);
            end
            if (lr_out_n != LRLEN || lr_c2 - lr_c1 > 10) begin
                $sformat(msg, "packet %0d: first beat out %0d cycles after the last beat in", ph, lr_c2 - lr_c1);
                fail(C_LINE);
            end
            if (lr_gap != 0) begin
                $sformat(msg, "packet %0d: %0d gaps in the output with out_ready high", ph, lr_gap);
                fail(C_LINE);
            end
        end

        // backpressure on long store-and-forward packets
        cur = C_BP; do_reset(1'b0);
        traffic(60, 4, 40, 0, 90, 50, 30, 40000);

        // everything: both modes, drops, short and long packets, backpressure
        cur = C_MIXED; do_reset(1'b0);
        for (ph = 0; ph < 4; ph = ph + 1) begin
            traffic(40, 1, 40, 15, 75, 70, 15, 40000);
            repeat (10) step;
            cfg_ct = ~cfg_ct;      // the block is empty and idle here
            repeat (2) step;
        end
        if (drop_count !== drops_exp[15:0]) begin
            $sformat(msg, "drop_count %0d, expected %0d", drop_count, drops_exp);
            fail(C_DROP);
        end

        show(C_RESET,   "reset_idle");
        show(C_DROP,    "drop_count");
        show(C_SFLONG,  "sf_long");
        show(C_SFSHORT, "sf_short");
        show(C_CT,      "ct_stream");
        show(C_LINE,    "line_rate");
        show(C_BP,      "backpressure");
        show(C_MIXED,   "mixed");
        $display("DONE %h", nonce);
        $finish;
    end

endmodule

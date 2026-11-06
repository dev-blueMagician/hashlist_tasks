`timescale 1ns/1ps
// Withheld bench for pktbuf on board rev C.
//
// The SRAM model is the NW61P1024 as its datasheet describes it, with LAT
// strapped high (ECO-117): read data is captured at command edge + 3, write
// data is sampled at command edge + 1, and the array location is written at
// command edge + 2, so a read of that address at edge + 1 or + 2 returns the
// previous contents. Unused read cycles return random data.
//
// Store-and-forward packets may be retried: out_retry high with a last beat
// that moves means the same packet comes again, in full, before anything else.
//
// Each scenario starts from a reset and drives random traffic from +seed.
// The bench keeps its own model of what must come out and compares every
// output beat. In every scenario it also checks the valid/ready hold rule
// (spec 4) and that the SRAM is left alone once the block is empty (5.6).
// It prints CHECK <nonce> <name> PASS|FAIL <why> for each check, then DONE.
module tb_pktbuf #(
    parameter DW = 32,
    parameter AW = 10,
    parameter OLDPART = 0     // 1: rev B NW61F model instead (author's check of the base design)
);
    localparam CAP    = 1 << AW;
    localparam EQ     = 8192;                 // expected-beat ring
    localparam SFMAX  = (CAP < 40) ? CAP : 40; // longest store-and-forward packet sent
    localparam LRLEN  = (CAP < 32) ? CAP : 32;
    localparam CTLONG = 100;                  // long cut-through packets: 100..160 beats
    localparam NCHK   = 12;
    localparam C_RESET = 0, C_DROP = 1, C_SFLONG = 2, C_SFSHORT = 3, C_CT = 4, C_CTLAT = 5,
               C_LINE = 6, C_DRAIN = 7, C_CAP = 8, C_BP = 9, C_MIXED = 10, C_RETRY = 11;

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
    reg           out_retry = 1'b0;
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
        .out_last(out_last), .out_err(out_err), .out_retry(out_retry),
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

    generate if (OLDPART) begin : g_old
    always @(posedge clk) begin   // NW61F1024 flow-through (rev B)
        if (sram_ce_n === 1'b0 && sram_we_n === 1'b0)
            mem[sram_addr] <= sram_wdata;
        if (sram_ce_n === 1'b0 && sram_we_n === 1'b1)
            sram_rdata <= mem[sram_addr];
        else
            sram_rdata <= $random(mseed);
    end
    end else begin : g_new
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
    end endgenerate

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
    integer       p_retry;        // % chance out_retry is high (store-and-forward)
    integer       p_junk;         // % chance out_retry is high in cut-through (ignored)
    integer       pk_out0;        // expected-queue index of the first beat of the packet going out
    reg           out_first;      // the next beat out starts a packet
    integer       n_retry;

    reg           hold_pend;      // a beat was offered and not taken last cycle
    reg  [DW-1:0] hold_d;
    reg           hold_l, hold_e;
    reg           idle_chk;       // the block is empty: no SRAM command expected

    integer       cur;            // check being exercised
    integer       nfail [0:NCHK-1];
    reg [8*120-1:0] why  [0:NCHK-1];
    reg [8*120-1:0] msg;

    // timing measurements
    integer       lr_in_n, lr_c0, lr_c1, lr_out_n, lr_c2, lr_c3, lr_gap;

    integer       i, k, ph, n, t0;

    function integer rnd(input integer m);
        begin
            rnd = ($random(seed) & 32'h7fffffff) % m;
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
        integer j;
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
            out_retry = cfg_ct ? (rnd(100) < p_junk) : (rnd(100) < p_retry);
            #1;
            if (out_valid !== 1'b0 && out_valid !== 1'b1) begin
                $sformat(msg, "out_valid is %b at cycle %0d", out_valid, cyc); fail(cur);
            end
            if (in_ready !== 1'b0 && in_ready !== 1'b1) begin
                $sformat(msg, "in_ready is %b at cycle %0d", in_ready, cyc); fail(cur);
            end
            if (hold_pend && (out_valid !== 1'b1 || out_data !== hold_d || out_last !== hold_l || out_err !== hold_e)) begin
                $sformat(msg, "cycle %0d: an offered output beat (%h last %b err %b) was withdrawn or changed before it moved",
                         cyc, hold_d, hold_l, hold_e);
                fail(cur);
            end
            if (idle_chk && sram_ce_n !== 1'b1) begin
                $sformat(msg, "cycle %0d: SRAM command (ce_n %b we_n %b) while the block is empty", cyc, sram_ce_n, sram_we_n);
                fail(cur);
            end
            in_hs  = in_valid && (in_ready === 1'b1);
            out_hs = (out_valid === 1'b1) && out_ready;
            hold_pend = (out_valid === 1'b1) && !out_ready;
            hold_d = out_data; hold_l = out_last; hold_e = out_err;

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
                    if (out_first)
                        pk_out0 = eq_rp;
                    out_first = out_last;
                    eq_rp = eq_rp + 1;
                    // a retried packet is expected again, in full, before anything else
                    if (out_last && out_retry && !cfg_ct) begin
                        eq_rp   = pk_out0;
                        n_retry = n_retry + 1;
                    end
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
                            for (j = 0; j < st_n; j = j + 1) begin
                                k = eq_wp % EQ;
                                eq_d[k] = st_d[j];
                                eq_l[k] = (j == st_n - 1);
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

    task lr_clear;
        begin
            lr_in_n = 0; lr_out_n = 0; lr_gap = 0;
            lr_c0 = 0; lr_c1 = 0; lr_c2 = 0; lr_c3 = 0;
        end
    endtask

    // Reset, then watch the idle block (must check reset_idle).
    task do_reset(input ct);
        integer j;
        begin
            @(negedge clk);
            rst_n = 1'b0;
            in_valid = 1'b0; in_taken = 1'b0; in_last = 1'b0; in_err = 1'b0; out_ready = 1'b0;
            cfg_ct = ct;
            gen_on = 1'b0; pk_left = 0; bt_left = 0; stall_left = 0; p_stall = 0;
            eq_wp = 0; eq_rp = 0; st_n = 0; drops_exp = 0;
            hold_pend = 1'b0; idle_chk = 1'b0;
            p_retry = 0; p_junk = 0; out_retry = 1'b0; out_first = 1'b1; pk_out0 = 0;
            lr_clear;
            for (j = 0; j < 3; j = j + 1) begin
                #1;
                if (out_valid !== 1'b0 || sram_ce_n !== 1'b1) begin
                    $sformat(msg, "during reset: out_valid %b, sram_ce_n %b", out_valid, sram_ce_n); fail(C_RESET);
                end
                @(negedge clk);
            end
            rst_n = 1'b1;
            cyc = 0;
            for (j = 0; j < 16; j = j + 1) begin
                @(negedge clk);
                #1;
                if (out_valid !== 1'b0) begin
                    $sformat(msg, "out_valid is %b %0d cycles after reset", out_valid, j); fail(C_RESET);
                end
                if (sram_ce_n !== 1'b1) begin
                    $sformat(msg, "SRAM command (ce_n %b) %0d cycles after reset with no traffic", sram_ce_n, j); fail(C_RESET);
                end
                if (drop_count !== 16'd0) begin
                    $sformat(msg, "drop_count is %h after reset", drop_count); fail(C_RESET);
                end
                if (j >= 4 && in_ready !== 1'b1) begin
                    $sformat(msg, "in_ready is %b %0d cycles after reset", in_ready, j); fail(C_RESET);
                end
            end
        end
    endtask

    task set_policy(input integer lmin, input integer lmax, input integer perr,
                    input integer pin, input integer pout, input integer pstall);
        begin
            l_min = lmin; l_max = lmax;
            if (!cfg_ct && l_max > SFMAX) l_max = SFMAX;
            if (l_min > l_max) l_min = l_max;
            p_err = perr; p_in = pin; p_out = pout; p_stall = pstall;
        end
    endtask

    // Send until pk_left is 0 (or limit), without draining.
    task send_all(input integer limit);
        begin
            gen_on = 1'b1;
            t0 = cyc;
            while ((pk_left > 0 || (in_valid && !in_taken)) && cyc - t0 < limit)
                step;
            gen_on = 1'b0;
            if (pk_left > 0 || (in_valid && !in_taken)) begin
                $sformat(msg, "stalled: %0d packets not taken after %0d cycles", pk_left, cyc - t0);
                fail(cur);
                in_valid = 1'b0; in_taken = 1'b0; pk_left = 0; bt_left = 0;
            end
        end
    endtask

    // Deliver everything expected with out_ready high, then watch the empty
    // block for 20 cycles: no output beat and, after 4 cycles, no SRAM command.
    task drain(input integer limit);
        integer j;
        begin
            p_out = 100; p_stall = 0; stall_left = 0; p_retry = 0;
            t0 = cyc;
            while (eq_rp != eq_wp && cyc - t0 < limit)
                step;
            if (eq_rp != eq_wp) begin
                $sformat(msg, "stalled: %0d beats not delivered after %0d cycles", eq_wp - eq_rp, cyc - t0);
                fail(cur);
                eq_rp = eq_wp;
            end
            for (j = 0; j < 20; j = j + 1) begin
                if (j == 4) idle_chk = 1'b1;
                step;
            end
            idle_chk = 1'b0;
        end
    endtask

    task traffic(input integer npk, input integer lmin, input integer lmax, input integer perr,
                 input integer pin, input integer pout, input integer pstall, input integer limit);
        begin
            set_policy(lmin, lmax, perr, pin, pout, pstall);
            pk_left = npk; bt_left = 0;
            send_all(limit);
            drain(limit);
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

        // cut-through with backpressure; errors forwarded on the last beat;
        // packets longer than the buffer
        cur = C_CT; do_reset(1'b1);
        p_junk = 30;
        traffic(30, 1, 30, 20, 60, 70, 10, 20000);
        traffic(20, 1, 30, 20, 100, 85, 5, 20000);
        traffic(4, CTLONG, CTLONG + 60, 20, 90, 60, 10, 40000);

        // cut-through first-beat latency into an empty block (spec 6.4)
        cur = C_CTLAT; do_reset(1'b1);
        p_junk = 30;
        for (ph = 0; ph < 40; ph = ph + 1) begin
            n = 1 + rnd(6);
            repeat (n) step;
            lr_clear;
            traffic(1, 1, 12, 20, (ph % 2) ? 100 : 50 + rnd(51), 100, 0, 2000);
            if (lr_out_n == 0 || lr_c2 - lr_c0 > 5) begin
                $sformat(msg, "packet %0d: first beat out %0d cycles after it was taken", ph, lr_c2 - lr_c0);
                fail(C_CTLAT);
            end
        end

        // line rate: a packet into an empty buffer, then streamed out (6.3)
        cur = C_LINE; do_reset(1'b0);
        for (ph = 0; ph < 6; ph = ph + 1) begin
            n = (ph < 3) ? ph + 1 : (ph == 3) ? LRLEN : 4 + rnd(LRLEN - 3);
            if (n > LRLEN) n = LRLEN;
            lr_clear;
            traffic(1, n, n, 0, 100, 100, 0, 2000);
            if (lr_in_n != n || lr_c1 - lr_c0 != n - 1) begin
                $sformat(msg, "%0d-beat packet: %0d beats took %0d cycles to enter", n, lr_in_n, lr_c1 - lr_c0 + 1);
                fail(C_LINE);
            end
            if (lr_out_n != n || lr_c2 - lr_c1 > 10) begin
                $sformat(msg, "%0d-beat packet: first beat out %0d cycles after the last beat in", n, lr_c2 - lr_c1);
                fail(C_LINE);
            end
            if (lr_gap != 0) begin
                $sformat(msg, "%0d-beat packet: %0d gaps in the output with out_ready high", n, lr_gap);
                fail(C_LINE);
            end
        end

        // stored packets stream out without gaps once out_ready rises (6.2)
        cur = C_DRAIN; do_reset(1'b0);
        for (ph = 0; ph < 5; ph = ph + 1) begin
            set_policy(4, 12, 0, 50 + rnd(51), 0, 0);
            pk_left = 2 + rnd(4); bt_left = 0;
            send_all(2000);
            repeat (10) step;
            lr_clear;
            drain(2000);
            if (lr_gap != 0) begin
                $sformat(msg, "round %0d: %0d gaps while stored beats were sent with out_ready high", ph, lr_gap);
                fail(C_DRAIN);
            end
        end

        // eight complete packets are held while egress is stalled (5.5)
        cur = C_CAP; do_reset(1'b0);
        for (ph = 0; ph < 3; ph = ph + 1) begin
            n = (CAP / 8 < 4) ? CAP / 8 : 4;
            set_policy(n, n, 0, 100, 0, 0);
            pk_left = 8; bt_left = 0;
            t0 = cyc;
            gen_on = 1'b1;
            while ((pk_left > 0 || (in_valid && !in_taken)) && cyc - t0 < 300)
                step;
            gen_on = 1'b0;
            if (pk_left > 0) begin
                $sformat(msg, "round %0d: with out_ready low only %0d of 8 %0d-beat packets were taken",
                         ph, 8 - pk_left - ((bt_left > 0) ? 1 : 0), n);
                fail(C_CAP);
                in_valid = 1'b0; in_taken = 1'b0; pk_left = 0; bt_left = 0;
            end
            repeat (5) step;
            drain(2000);
        end

        // backpressure on long store-and-forward packets
        cur = C_BP; do_reset(1'b0);
        traffic(60, 4, 40, 0, 90, 50, 30, 40000);

        // store-and-forward retries: short and long packets, backpressure
        cur = C_RETRY; do_reset(1'b0);
        n_retry = 0;
        for (ph = 0; ph < 3; ph = ph + 1) begin
            set_policy((ph == 0) ? 1 : 4, (ph == 0) ? 3 : 40, 10, 80, (ph == 2) ? 50 : 100, (ph == 2) ? 20 : 0);
            p_retry = 30;
            pk_left = 40; bt_left = 0;
            send_all(40000);
            drain(40000);
        end
        if (n_retry == 0) begin
            msg = "no retry happened"; fail(C_RETRY);
        end

        // everything: both modes, drops, retries, short and long packets, backpressure
        cur = C_MIXED; do_reset(1'b0);
        p_junk = 30;
        for (ph = 0; ph < 4; ph = ph + 1) begin
            set_policy(1, 40, 15, 75, 70, 15);
            p_retry = 15;
            pk_left = 40; bt_left = 0;
            send_all(40000);
            drain(40000);
            repeat (10) step;
            cfg_ct = ~cfg_ct;      // the block is empty and idle here (5.4)
            repeat (10) step;
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
        show(C_CTLAT,   "ct_latency");
        show(C_LINE,    "line_rate");
        show(C_DRAIN,   "drain_rate");
        show(C_CAP,     "capacity");
        show(C_BP,      "backpressure");
        show(C_RETRY,   "retry");
        show(C_MIXED,   "mixed");
        $display("DONE %h", nonce);
        $finish;
    end

endmodule

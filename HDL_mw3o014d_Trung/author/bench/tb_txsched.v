// tb_txsched.v -- withheld bench for txsched rev B (ECR-0731).
//
// A cycle-exact model of docs/txsched_spec.md with ECR-0731 runs beside
// the design on the stimulus the bench actually drives, and every output
// is compared in every cycle. Each phase starts from reset and reports one
// check. Stimulus comes from +seed; the expected results come only from
// the model, so Icarus and Verilator may draw different numbers.
//
// The bench keeps to the ECR's promises: every queued launch time stays
// within 2^(TS_W-2) ticks of now (the ECR allows 2^(TS_W-1) - 1), and
// LATE_WIN is at most 2^(TS_W-2).
//
// Checks: reset_idle and best_effort hold on rev A (must); the others need
// rev B.

`timescale 1ns / 1ps

module tb_txsched #(
    parameter NCH      = 4,
    parameter DW       = 16,
    parameter DEPTH    = 4,
    parameter TS_W     = 32,
    parameter PRESC    = 1,
    parameter LATE_WIN = 64,
    parameter CYC      = 3000      // cycles per random phase
);

    localparam NCHK = 10;
    localparam [TS_W-1:0] QUART = {2'b01, {(TS_W-2){1'b0}}};   // 2^(TS_W-2)

    // ------------------------------------------------------------- the DUT

    reg              clk;
    reg              rst_n;
    reg              in_valid;
    wire             in_ready;
    reg  [2:0]       in_ch;
    reg  [DW-1:0]    in_data;
    reg              in_lt_en;
    reg  [TS_W-1:0]  in_lt;
    wire             out_valid;
    reg              out_ready;
    wire [2:0]       out_ch;
    wire [DW-1:0]    out_data;
    wire [TS_W-1:0]  out_gts;
    reg              pause;
    reg              ts_set;
    reg  [TS_W-1:0]  ts_set_val;
    wire [TS_W-1:0]  now;
    wire [NCH-1:0]   late_mask;
    wire [15:0]      late_cnt;

    txsched #(
        .NCH      (NCH),
        .DW       (DW),
        .DEPTH    (DEPTH),
        .TS_W     (TS_W),
        .PRESC    (PRESC),
        .LATE_WIN (LATE_WIN)
    ) dut (
        .clk        (clk),
        .rst_n      (rst_n),
        .in_valid   (in_valid),
        .in_ready   (in_ready),
        .in_ch      (in_ch),
        .in_data    (in_data),
        .in_lt_en   (in_lt_en),
        .in_lt      (in_lt),
        .out_valid  (out_valid),
        .out_ready  (out_ready),
        .out_ch     (out_ch),
        .out_data   (out_data),
        .out_gts    (out_gts),
        .pause      (pause),
        .ts_set     (ts_set),
        .ts_set_val (ts_set_val),
        .now        (now),
        .late_mask  (late_mask),
        .late_cnt   (late_cnt)
    );

    initial clk = 1'b0;
    always #5 clk = ~clk;

    // ----------------------------------------------------------- the model

    reg [DW-1:0]   mq_data [0:127];     // channel ch, slot s at ch*16 + s
    reg            mq_sc   [0:127];
    reg [TS_W-1:0] mq_lt   [0:127];
    integer        mq_rp   [0:7];
    integer        mq_n    [0:7];

    reg [TS_W-1:0] m_now;
    integer        m_pc;
    reg            m_ov;
    reg [2:0]      m_och;
    reg [DW-1:0]   m_odata;
    reg [TS_W-1:0] m_ogts;
    integer        m_rr;
    reg [NCH-1:0]  m_mask;
    reg [15:0]     m_cnt;

    reg [TS_W-1:0] t_next;
    reg [TS_W-1:0] t_d;
    reg [TS_W-1:0] t_best;
    reg [7:0]      t_drop;
    reg            t_free;
    reg            t_push;
    reg            t_sc;
    integer        t_sel;
    integer        ch;
    integer        k;
    integer        c;
    integer        e;

    // statistics, to make sure each phase did what it is for
    integer st_sc_out;      // scheduled frames that appeared
    integer st_drops;
    integer st_edf;         // takes with two or more scheduled candidates
    integer st_class;       // takes of a scheduled frame while a best-effort head waited
    integer st_steps;
    integer st_wraps;

    always @(posedge clk) begin
        if (!rst_n) begin
            m_now  = {TS_W{1'b0}};
            m_pc   = 0;
            m_ov   = 1'b0;
            m_rr   = NCH - 1;
            m_mask = {NCH{1'b0}};
            m_cnt  = 16'd0;
            for (ch = 0; ch < 8; ch = ch + 1) begin
                mq_rp[ch] = 0;
                mq_n[ch]  = 0;
            end
        end else begin
            t_push = in_valid && (in_ch < NCH) && (mq_n[in_ch] < DEPTH);

            if (ts_set)
                t_next = ts_set_val;
            else if (!pause && m_pc == PRESC - 1)
                t_next = m_now + 1'b1;
            else
                t_next = m_now;

            t_free = !m_ov || out_ready;

            // late heads drop, whatever the output stage does
            t_drop = 8'd0;
            for (ch = 0; ch < NCH; ch = ch + 1) begin
                if (!pause && mq_n[ch] > 0) begin
                    e = ch * 16 + mq_rp[ch];
                    if (mq_sc[e]) begin
                        t_d = t_next - mq_lt[e];
                        if (!t_d[TS_W-1] && t_d >= LATE_WIN)
                            t_drop[ch] = 1'b1;
                    end
                end
            end

            // the take: scheduled frames due by the next cycle, earliest
            // launch time first, ties in round-robin order; then
            // best-effort frames in round-robin order
            t_sel = -1;
            t_sc  = 1'b0;
            if (t_free && !pause) begin
                for (k = 1; k <= NCH; k = k + 1) begin
                    c = (m_rr + k) % NCH;
                    if (mq_n[c] > 0 && !t_drop[c]) begin
                        e = c * 16 + mq_rp[c];
                        if (mq_sc[e]) begin
                            t_d = t_next - mq_lt[e];
                            if (!t_d[TS_W-1]) begin
                                if (t_sc)
                                    st_edf = st_edf + 1;
                                if (!t_sc || t_d > t_best) begin
                                    t_sel  = c;
                                    t_sc   = 1'b1;
                                    t_best = t_d;
                                end
                            end
                        end
                    end
                end
                if (!t_sc) begin
                    for (k = NCH; k >= 1; k = k - 1) begin
                        c = (m_rr + k) % NCH;
                        if (mq_n[c] > 0 && !mq_sc[c * 16 + mq_rp[c]])
                            t_sel = c;
                    end
                end else begin
                    for (c = 0; c < NCH; c = c + 1)
                        if (mq_n[c] > 0 && !mq_sc[c * 16 + mq_rp[c]])
                            st_class = st_class + 1;
                end
            end

            if (t_free) begin
                if (t_sel >= 0) begin
                    e       = t_sel * 16 + mq_rp[t_sel];
                    m_ov    = 1'b1;
                    m_och   = t_sel;
                    m_odata = mq_data[e];
                    m_ogts  = m_now;
                    m_rr    = t_sel;
                    if (t_sc)
                        st_sc_out = st_sc_out + 1;
                    mq_rp[t_sel] = (mq_rp[t_sel] + 1) % DEPTH;
                    mq_n[t_sel]  = mq_n[t_sel] - 1;
                end else begin
                    m_ov = 1'b0;
                end
            end

            for (ch = 0; ch < NCH; ch = ch + 1) begin
                if (t_drop[ch]) begin
                    mq_rp[ch] = (mq_rp[ch] + 1) % DEPTH;
                    mq_n[ch]  = mq_n[ch] - 1;
                    m_cnt     = m_cnt + 1'b1;
                    st_drops  = st_drops + 1;
                end
            end
            m_mask = t_drop[NCH-1:0];

            if (t_push) begin
                e = in_ch * 16 + (mq_rp[in_ch] + mq_n[in_ch]) % DEPTH;
                mq_data[e] = in_data;
                mq_sc[e]   = in_lt_en;
                mq_lt[e]   = in_lt;
                mq_n[in_ch] = mq_n[in_ch] + 1;
            end

            if (!ts_set && t_next < m_now)
                st_wraps = st_wraps + 1;
            if (ts_set)
                st_steps = st_steps + 1;

            m_now = t_next;
            if (ts_set)
                m_pc = 0;
            else if (!pause)
                m_pc = (m_pc == PRESC - 1) ? 0 : m_pc + 1;
        end
    end

    // ----------------------------------------------------------- checking

    reg [63:0]  nonce;
    integer     seed;
    integer     cur;                 // check being run
    reg         chk_on;
    reg         fail   [0:NCHK-1];
    string      why    [0:NCHK-1];
    integer     cyc;

    task note;
        input string msg;
        begin
            if (!fail[cur]) begin
                fail[cur] = 1'b1;
                why[cur]  = msg;
            end
        end
    endtask

    // Registered outputs, after the edge.
    task compare_outputs;
        begin
            if (chk_on) begin
                if (out_valid !== m_ov)
                    note($sformatf("cycle %0d: out_valid %b, expected %b", cyc, out_valid, m_ov));
                else if (m_ov && (out_ch !== m_och || out_data !== m_odata))
                    note($sformatf("cycle %0d: out_ch/out_data %0d/%h, expected %0d/%h", cyc, out_ch, out_data, m_och, m_odata));
                else if (m_ov && out_gts !== m_ogts)
                    note($sformatf("cycle %0d: out_gts %h, expected %h", cyc, out_gts, m_ogts));
                if (now !== m_now)
                    note($sformatf("cycle %0d: now %h, expected %h", cyc, now, m_now));
                if (late_mask !== m_mask)
                    note($sformatf("cycle %0d: late_mask %b, expected %b", cyc, late_mask, m_mask));
                if (late_cnt !== m_cnt)
                    note($sformatf("cycle %0d: late_cnt %0d, expected %0d", cyc, late_cnt, m_cnt));
            end
        end
    endtask

    // in_ready follows in_ch in the same cycle.
    task compare_ready;
        begin
            if (chk_on && in_ready !== ((in_ch < NCH) && (mq_n[in_ch] < DEPTH)))
                note($sformatf("cycle %0d: in_ready %b for channel %0d", cyc, in_ready, in_ch));
        end
    endtask

    // ------------------------------------------------------- the stimulus

    function integer urand;          // 0 .. n-1
        input integer n;
        reg [31:0] r;
        begin
            r = $random(seed);
            urand = (n <= 1) ? 0 : (r % n);
        end
    endfunction

    // Knobs for one random phase, in percent.
    integer p_in;           // a frame offered
    integer p_sc;           // it is scheduled
    integer p_ready;        // out_ready high
    integer p_pause;        // pause starts
    integer p_set;          // a time step
    integer ahead_max;      // launch offset ahead of now, ticks
    integer behind_max;     // launch offset behind now, ticks
    integer step_max;       // size of a time step, ticks
    integer pause_left;
    integer ready_hold;

    function integer min2;
        input integer a, b;
        begin
            min2 = (a < b) ? a : b;
        end
    endfunction

    // Would every queued launch time stay within 2^(TS_W-2) - 2*DEPTH - 4
    // ticks of t? (late frames drift up to DEPTH ticks further before
    // they drop)
    function step_ok;
        input [TS_W-1:0] t;
        integer x, y;
        reg [TS_W-1:0] r;
        reg [TS_W-1:0] lim;
        begin
            step_ok = 1'b1;
            lim = QUART - 2 * DEPTH - 4;
            for (x = 0; x < NCH; x = x + 1)
                for (y = 0; y < mq_n[x]; y = y + 1) begin
                    e = x * 16 + (mq_rp[x] + y) % DEPTH;
                    if (mq_sc[e]) begin
                        r = mq_lt[e] - t;
                        if (r[TS_W-1]) r = -r;
                        if (r >= lim) step_ok = 1'b0;
                    end
                end
        end
    endfunction

    function any_sc_queued;
        input dummy;
        integer x, y;
        begin
            any_sc_queued = 1'b0;
            for (x = 0; x < NCH; x = x + 1)
                for (y = 0; y < mq_n[x]; y = y + 1)
                    if (mq_sc[x * 16 + (mq_rp[x] + y) % DEPTH]) any_sc_queued = 1'b1;
        end
    endfunction

    task offer_frame;
        input force_sc;
        integer off;
        begin
            in_valid = 1'b1;
            in_ch    = urand(NCH);
            in_data  = $random(seed);
            in_lt    = $random(seed);          // junk for best-effort frames
            in_lt_en = force_sc || (urand(100) < p_sc);
            if (in_lt_en) begin
                if (urand(100) < 75)
                    off = 1 + urand(ahead_max);
                else
                    off = -urand(behind_max + 1);
                in_lt = m_now + off;
            end
        end
    endtask

    task idle_inputs;
        begin
            in_valid   = 1'b0;
            in_ch      = urand(8);
            in_data    = $random(seed);
            in_lt_en   = urand(2);
            in_lt      = $random(seed);
            out_ready  = 1'b1;
            pause      = 1'b0;
            ts_set     = 1'b0;
            ts_set_val = $random(seed);
        end
    endtask

    // One cycle: compare what the last edge produced, drive the next
    // inputs, compare in_ready, wait for the edge.
    task step_cycle;
        input do_offer;
        reg [TS_W-1:0] tv;
        integer s;
        begin
            @(negedge clk);
            cyc = cyc + 1;
            compare_outputs;
            idle_inputs;
            if (do_offer && urand(100) < p_in)
                offer_frame(1'b0);
            if (ready_hold > 0) begin
                ready_hold = ready_hold - 1;
                out_ready  = 1'b0;
            end else
                out_ready = (urand(100) < p_ready);
            if (pause_left > 0) begin
                pause_left = pause_left - 1;
                pause = 1'b1;
            end else if (urand(1000) < p_pause * 10) begin
                pause_left = urand(4 * PRESC + 6);
                pause = 1'b1;
            end
            if (urand(1000) < p_set * 10) begin
                s = 1 + urand(step_max);
                tv = (urand(2) == 0) ? m_now + s : m_now - s;
                if (step_ok(tv)) begin
                    ts_set     = 1'b1;
                    ts_set_val = tv;
                end
            end
            #1;
            compare_ready;
        end
    endtask

    task do_reset;
        integer i;
        begin
            @(negedge clk);
            idle_inputs;
            rst_n  = 1'b0;
            chk_on = 1'b0;
            for (i = 0; i < 3; i = i + 1) @(negedge clk);
            rst_n  = 1'b1;
            chk_on = 1'b1;
            pause_left = 0;
            ready_hold = 0;
        end
    endtask

    task knobs;
        input integer in_, sc_, ready_, pause_, set_;
        begin
            p_in = in_;  p_sc = sc_;  p_ready = ready_;  p_pause = pause_;  p_set = set_;
        end
    endtask

    task run;
        input integer n;
        integer i;
        begin
            for (i = 0; i < n; i = i + 1) step_cycle(1'b1);
        end
    endtask

    task report;
        input integer id;
        input [8*16-1:0] name;
        begin
            if (fail[id])
                $display("CHECK %h %0s FAIL %0s", nonce, name, why[id]);
            else
                $display("CHECK %h %0s PASS", nonce, name);
        end
    endtask

    task need;      // a phase that did not exercise its feature proves nothing
        input cond;
        input [8*60-1:0] msg;
        begin
            if (!cond) note($sformatf("bench: %0s", msg));
        end
    endtask

    integer i, j, s0, s1, s2, s3;

    initial begin
        if (!$value$plusargs("nonce=%h", nonce)) nonce = 64'h0;
        if (!$value$plusargs("seed=%d", seed)) seed = 1;
        for (i = 0; i < NCHK; i = i + 1) begin
            fail[i] = 1'b0;
            why[i]  = "";
        end
        cyc = 0;
        st_sc_out = 0; st_drops = 0; st_edf = 0; st_class = 0; st_steps = 0; st_wraps = 0;
        chk_on = 1'b0;
        rst_n  = 1'b0;
        idle_inputs;
        ahead_max  = min2(4 * LATE_WIN + 8, QUART / 2);
        behind_max = min2(LATE_WIN + 8, QUART / 2);
        step_max   = min2(2 * LATE_WIN + 4, QUART / 2);
        pause_left = 0;
        ready_hold = 0;

        // 0 reset_idle: after reset the stage is empty, now counts from 0
        // once every PRESC cycles, nothing drops, every queue has room.
        cur = 0;
        do_reset;
        knobs(0, 0, 100, 0, 0);
        for (i = 0; i < 40 * PRESC; i = i + 1) step_cycle(1'b0);

        // 1 best_effort: rev A traffic only (no launch times), with
        // backpressure, pauses and time steps.
        cur = 1;
        do_reset;
        knobs(60, 0, 60, 3, 2);
        run(CYC);

        // 2 launch_on_time: sparse scheduled frames on a free output; each
        // appears in the cycle now reaches its launch time.
        cur = 2;
        do_reset;
        s0 = st_sc_out;
        knobs(6, 100, 100, 0, 0);
        run(CYC);
        need(st_sc_out - s0 > 10, "too few scheduled frames appeared");

        // 3 edf_order: scheduled frames on every channel competing for a
        // slow output.
        // Launch times close to now, so several heads are due at once.
        cur = 3;
        do_reset;
        s0 = st_edf;
        ahead_max  = min2(LATE_WIN / 2 + 2, QUART / 2);
        behind_max = min2(LATE_WIN / 2 + 1, QUART / 2);
        knobs(70, 100, 25, 0, 0);
        run(CYC);
        ahead_max  = min2(4 * LATE_WIN + 8, QUART / 2);
        behind_max = min2(LATE_WIN + 8, QUART / 2);
        need(st_edf - s0 > 20, "too few earliest-first decisions");

        // 4 class_priority: best-effort and scheduled frames mixed.
        cur = 4;
        do_reset;
        s0 = st_class;
        ahead_max  = min2(LATE_WIN / 2 + 2, QUART / 2);
        behind_max = min2(LATE_WIN / 2 + 1, QUART / 2);
        knobs(70, 50, 35, 0, 0);
        run(CYC);
        ahead_max  = min2(4 * LATE_WIN + 8, QUART / 2);
        behind_max = min2(LATE_WIN + 8, QUART / 2);
        need(st_class - s0 > 20, "too few class decisions");

        // 5 late_drop: an output held off long enough that frames go late,
        // and frames queued already late.
        cur = 5;
        do_reset;
        s0 = st_drops;
        knobs(50, 100, 50, 0, 0);
        for (i = 0; i < CYC / 200; i = i + 1) begin
            ready_hold = LATE_WIN * PRESC / 2 + urand(LATE_WIN * PRESC + 8);
            run(200);
        end
        need(st_drops - s0 > 10, "too few late drops");

        // 6 wrap: traffic across the counter wrapping, at any TS_W. The
        // queues drain, the counter is set a little before the wrap, and
        // traffic resumes.
        cur = 6;
        do_reset;
        s0 = st_wraps;
        knobs(55, 70, 45, 0, 0);
        for (i = 0; i < CYC / 300; i = i + 1) begin
            knobs(0, 70, 100, 0, 0);
            j = 0;
            while (any_sc_queued(1'b0) && j < 400) begin
                step_cycle(1'b1);
                j = j + 1;
            end
            @(negedge clk);
            cyc = cyc + 1;
            compare_outputs;
            idle_inputs;
            if (!any_sc_queued(1'b0)) begin
                ts_set     = 1'b1;
                ts_set_val = {TS_W{1'b1}} - urand(ahead_max / 2 + 4);
            end
            #1;
            compare_ready;
            knobs(55, 70, 45, 0, 0);
            run(300);
        end
        need(st_wraps - s0 > 3, "the counter did not wrap");

        // 7 time_step: forward and backward time steps under scheduled
        // traffic.
        cur = 7;
        do_reset;
        s0 = st_steps;
        knobs(55, 80, 55, 0, 6);
        run(CYC);
        need(st_steps - s0 > 50, "too few time steps");

        // 8 pause_tick: pauses under scheduled traffic.
        cur = 8;
        do_reset;
        knobs(55, 80, 70, 8, 0);
        run(CYC);

        // 9 mixed: everything at once.
        cur = 9;
        do_reset;
        knobs(60, 55, 50, 3, 3);
        run(CYC);
        for (i = 0; i < 4; i = i + 1) begin
            ready_hold = LATE_WIN * PRESC + urand(16);
            run(CYC / 8);
        end

        $display("stats sc_out=%0d drops=%0d edf=%0d class=%0d steps=%0d wraps=%0d", st_sc_out, st_drops, st_edf, st_class, st_steps, st_wraps);
        report(0, "reset_idle");
        report(1, "best_effort");
        report(2, "launch_on_time");
        report(3, "edf_order");
        report(4, "class_priority");
        report(5, "late_drop");
        report(6, "wrap");
        report(7, "time_step");
        report(8, "pause_tick");
        report(9, "mixed");
        $display("DONE %h", nonce);
        $finish;
    end

endmodule

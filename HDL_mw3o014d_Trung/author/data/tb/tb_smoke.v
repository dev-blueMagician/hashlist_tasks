// tb_smoke.v -- smoke test for txsched rev A at the default parameters.
//
// Best-effort descriptors only. Checks that every descriptor comes out
// once, in order within its channel, with the right data; that the
// output holds while out_ready is low; that the channels are served round
// robin when all of them have descriptors; that now counts, holds while
// paused, and loads on ts_set; and that out_gts is the value of now in
// the cycle the descriptor was taken. Prints SMOKE PASS or SMOKE FAIL.

`timescale 1ns / 1ps

module tb_smoke;

    localparam NCH = 4, DW = 16, DEPTH = 4, TS_W = 32;

    reg              clk, rst_n;
    reg              in_valid;
    wire             in_ready;
    reg  [2:0]       in_ch;
    reg  [DW-1:0]    in_data;
    wire             out_valid;
    reg              out_ready;
    wire [2:0]       out_ch;
    wire [DW-1:0]    out_data;
    wire [TS_W-1:0]  out_gts;
    reg              pause, ts_set;
    reg  [TS_W-1:0]  ts_set_val;
    wire [TS_W-1:0]  now;
    wire [NCH-1:0]   late_mask;
    wire [15:0]      late_cnt;

    txsched dut (
        .clk (clk), .rst_n (rst_n),
        .in_valid (in_valid), .in_ready (in_ready), .in_ch (in_ch), .in_data (in_data),
        .in_lt_en (1'b0), .in_lt ({TS_W{1'b0}}),
        .out_valid (out_valid), .out_ready (out_ready), .out_ch (out_ch), .out_data (out_data), .out_gts (out_gts),
        .pause (pause), .ts_set (ts_set), .ts_set_val (ts_set_val), .now (now),
        .late_mask (late_mask), .late_cnt (late_cnt)
    );

    initial clk = 0;
    always #5 clk = ~clk;

    integer errors = 0;
    integer sent = 0, got = 0;
    reg [DW-1:0] expq [0:NCH-1][0:255];
    integer qh [0:NCH-1], qt [0:NCH-1];
    reg [TS_W-1:0] prev_now;
    integer cyc = 0;
    integer seed = 5;
    integer i, k;
    reg prev_valid, prev_ready;
    reg [2:0] prev_ch;
    reg [DW-1:0] prev_data;

    task fail(input [8*64-1:0] msg);
        begin
            errors = errors + 1;
            if (errors < 5) $display("smoke: %0s (cycle %0d)", msg, cyc);
        end
    endtask

    // Watch the output at every rising edge.
    always @(posedge clk) if (rst_n) begin
        // a descriptor new in this cycle was taken in the cycle before
        if (out_valid && (!prev_valid || prev_ready) && out_gts !== prev_now)
            fail("out_gts is not the value of now when the descriptor was taken");
        prev_now <= now;
        if (prev_valid && !prev_ready && (!out_valid || out_ch !== prev_ch || out_data !== prev_data))
            fail("the output changed while out_ready was low");
        if (out_valid && out_ready) begin
            if (qh[out_ch] == qt[out_ch]) fail("a descriptor came out that was never sent");
            else begin
                if (out_data !== expq[out_ch][qh[out_ch] % 256]) fail("descriptor out of order or corrupted");
                qh[out_ch] = qh[out_ch] + 1;
            end
            got = got + 1;
        end
        prev_valid <= out_valid;  prev_ready <= out_ready;
        prev_ch    <= out_ch;     prev_data  <= out_data;
        cyc = cyc + 1;
    end

    task send(input [2:0] ch, input [DW-1:0] d);
        begin
            @(negedge clk);
            in_valid = 1; in_ch = ch; in_data = d;
            #1;
            while (!in_ready) begin
                @(negedge clk);
                #1;
            end
            expq[ch][qt[ch] % 256] = d;
            qt[ch] = qt[ch] + 1;
            sent = sent + 1;
            @(negedge clk);
            in_valid = 0;
        end
    endtask

    initial begin
        rst_n = 0; in_valid = 0; in_ch = 0; in_data = 0; out_ready = 0;
        pause = 0; ts_set = 0; ts_set_val = 0;
        prev_valid = 0; prev_ready = 0; prev_ch = 0; prev_data = 0; prev_now = 0;
        for (i = 0; i < NCH; i = i + 1) begin qh[i] = 0; qt[i] = 0; end
        repeat (3) @(negedge clk);
        rst_n = 1;

        // 1. now counts from 0 after reset, one per cycle at PRESC = 1.
        @(negedge clk);
        if (now !== 1) fail("now does not count from 0 after reset");
        // pause holds it
        pause = 1;
        repeat (5) @(negedge clk);
        if (now !== 1) fail("now did not hold while paused");
        pause = 0;
        // ts_set loads it
        ts_set = 1; ts_set_val = 32'h1000_0000;
        @(negedge clk);
        ts_set = 0;
        if (now !== 32'h1000_0000) fail("ts_set did not load now");

        // 2. Fill every channel with the output held off, then release:
        // the channels must come out round robin from channel 0.
        out_ready = 0;
        for (k = 0; k < DEPTH; k = k + 1)
            for (i = 0; i < NCH; i = i + 1)
                send(i, {i[3:0], k[11:0]});
        @(negedge clk);
        out_ready = 1;
        for (k = 0; k < NCH * DEPTH; k = k + 1) begin
            @(posedge clk);
            #1;
        end
        repeat (4) @(negedge clk);

        // 3. Random traffic with backpressure and pauses.
        for (k = 0; k < 400; k = k + 1) begin
            @(negedge clk);
            out_ready = ($random(seed) % 4) != 0;
            pause     = ($random(seed) % 16) == 0;
            if (($random(seed) % 2) == 0) begin
                in_valid = 1;
                in_ch    = {$random(seed)} % NCH;
                in_data  = $random(seed);
                #1;
                if (in_ready) begin
                    expq[in_ch][qt[in_ch] % 256] = in_data;
                    qt[in_ch] = qt[in_ch] + 1;
                    sent = sent + 1;
                end
            end else
                in_valid = 0;
        end
        @(negedge clk);
        in_valid = 0; pause = 0; out_ready = 1;
        repeat (100) @(negedge clk);

        if (got !== sent) fail("not every descriptor came out");
        if (late_mask !== 0 || late_cnt !== 0) fail("late_mask or late_cnt is not 0");
        if (errors == 0) $display("SMOKE PASS (%0d descriptors)", got);
        else $display("SMOKE FAIL (%0d errors)", errors);
        $finish;
    end

    // Round robin after the release in part 2.
    reg [2:0] rr_expect;
    initial rr_expect = 0;
    always @(posedge clk) begin
        if (rst_n && out_valid && out_ready && got < NCH * DEPTH) begin
            if (out_ch !== rr_expect) fail("channels not served round robin");
            rr_expect = (rr_expect + 1) % NCH;
        end
    end

endmodule

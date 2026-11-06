`timescale 1ns/1ps
// Smoke test for pktbuf on board rev B (NW61F1024 flow-through SRAM).
//
// Sends a few packets in store-and-forward mode, then a few in cut-through
// mode, and checks that they come out unchanged. It is a quick sanity check,
// not a regression: no backpressure, no dropped packets, nothing else.
//
// The SRAM model follows docs/NW61F1024_excerpt.md: command, address and
// write data are sampled at the same rising edge; read data is captured by
// the FPGA at the next rising edge.
module tb_smoke;
    localparam DW = 32;
    localparam AW = 10;

    reg clk = 1'b0;
    always #5 clk = ~clk;

    reg           rst_n     = 1'b0;
    reg           cfg_ct    = 1'b0;
    reg           in_valid  = 1'b0;
    reg  [DW-1:0] in_data   = {DW{1'b0}};
    reg           in_last   = 1'b0;
    reg           in_err    = 1'b0;
    reg           out_ready = 1'b1;
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

    // NW61F1024 model
    reg [DW-1:0] mem [0:(1<<AW)-1];
    always @(posedge clk) begin
        if (sram_ce_n === 1'b0 && sram_we_n === 1'b0)
            mem[sram_addr] <= sram_wdata;
        if (sram_ce_n === 1'b0 && sram_we_n === 1'b1)
            sram_rdata <= mem[sram_addr];
        else
            sram_rdata <= 32'hDEADBEEF;
    end

    // expected beats, in order
    reg [DW-1:0] exp_d [0:1023];
    reg          exp_l [0:1023];
    integer      n_in, n_out, errors, i, p, len;

    // count what comes out
    always @(posedge clk) begin
        if (rst_n && out_valid && out_ready) begin
            if (out_data !== exp_d[n_out] || out_last !== exp_l[n_out] || out_err !== 1'b0) begin
                if (errors < 5)
                    $display("smoke: beat %0d: got %h last %b err %b, expected %h last %b",
                             n_out, out_data, out_last, out_err, exp_d[n_out], exp_l[n_out]);
                errors = errors + 1;
            end
            n_out = n_out + 1;
        end
    end

    task send_packet(input integer n);
        integer b;
        begin
            for (b = 0; b < n; b = b + 1) begin
                @(negedge clk);
                in_valid = 1'b1;
                in_data  = {p[7:0], b[7:0], 16'hA5C3} ^ (b * 32'h01000193);
                in_last  = (b == n - 1);
                exp_d[n_in] = in_data;
                exp_l[n_in] = in_last;
                n_in = n_in + 1;
                #1;
                while (in_ready !== 1'b1) begin
                    @(negedge clk);
                    #1;
                end
                @(posedge clk);              // the beat is taken at this edge
            end
            @(negedge clk);
            in_valid = 1'b0;
            in_last  = 1'b0;
        end
    endtask

    task wait_drain;
        integer t;
        begin
            t = 0;
            while (n_out < n_in && t < 2000) begin
                @(posedge clk);
                t = t + 1;
            end
        end
    endtask

    initial begin
        n_in = 0; n_out = 0; errors = 0;
        repeat (4) @(negedge clk);
        rst_n = 1'b1;
        repeat (4) @(negedge clk);

        cfg_ct = 1'b0;                       // store-and-forward
        for (p = 0; p < 6; p = p + 1) begin
            len = 5 + (p * 3) % 8;
            send_packet(len);
        end
        wait_drain;
        repeat (10) @(negedge clk);

        cfg_ct = 1'b1;                       // cut-through
        repeat (10) @(negedge clk);
        for (p = 6; p < 12; p = p + 1) begin
            len = 4 + (p * 5) % 9;
            send_packet(len);
        end
        wait_drain;
        repeat (10) @(negedge clk);

        if (n_out != n_in)
            $display("smoke: %0d beats sent, %0d received", n_in, n_out);
        if (errors == 0 && n_out == n_in && drop_count == 16'd0)
            $display("SMOKE PASS: %0d packets, %0d beats", p, n_in);
        else
            $display("SMOKE FAIL: %0d mismatches", errors);
        $finish;
    end

endmodule

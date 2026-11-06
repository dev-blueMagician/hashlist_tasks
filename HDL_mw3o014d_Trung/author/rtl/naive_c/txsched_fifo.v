// txsched_fifo.v
//
// One channel queue of the transmit scheduler: a synchronous FIFO of
// DEPTH entries, W bits wide. DEPTH need not be a power of two. The head
// entry is readable while the queue is not empty; push and pop may happen
// in the same cycle. The owner never pushes a full queue or pops an empty
// one.

`timescale 1ns / 1ps
`default_nettype none

module txsched_fifo #(
    parameter W     = 16,
    parameter DEPTH = 4
) (
    input  wire         clk,
    input  wire         rst_n,

    input  wire         push,
    input  wire [W-1:0] push_data,
    input  wire         pop,

    output wire [W-1:0] head,
    output wire         empty,
    output wire         full
);

    localparam AW = (DEPTH <= 2) ? 1 : $clog2(DEPTH);

    reg [W-1:0]  mem [0:DEPTH-1];
    reg [AW-1:0] rd_ptr;
    reg [AW-1:0] wr_ptr;
    reg [AW:0]   count;

    assign empty = (count == 0);
    assign full  = (count == DEPTH);
    assign head  = mem[rd_ptr];

    function [AW-1:0] next_ptr;
        input [AW-1:0] p;
        begin
            next_ptr = (p == DEPTH - 1) ? {AW{1'b0}} : p + 1'b1;
        end
    endfunction

    // Storage is not reset: an entry is only read after it was written.
    always @(posedge clk) begin
        if (push)
            mem[wr_ptr] <= push_data;
    end

    always @(posedge clk) begin
        if (!rst_n) begin
            rd_ptr <= {AW{1'b0}};
            wr_ptr <= {AW{1'b0}};
            count  <= {(AW+1){1'b0}};
        end else begin
            if (push)
                wr_ptr <= next_ptr(wr_ptr);
            if (pop)
                rd_ptr <= next_ptr(rd_ptr);
            if (push && !pop)
                count <= count + 1'b1;
            else if (pop && !push)
                count <= count - 1'b1;
        end
    end

endmodule

`default_nettype wire

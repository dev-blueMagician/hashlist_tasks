// txsched_timebase.v
//
// Time base of the transmit scheduler: the tick counter now, TS_W bits
// wide, wrapping. It advances by one every PRESC clock cycles in which
// pause is low. A ts_set cycle loads ts_set_val into the counter and
// restarts the prescaler, also while paused. See docs/txsched_spec.md,
// section 4.

`timescale 1ns / 1ps
`default_nettype none

module txsched_timebase #(
    parameter TS_W  = 32,
    parameter PRESC = 1
) (
    input  wire            clk,
    input  wire            rst_n,
    input  wire            pause,
    input  wire            ts_set,
    input  wire [TS_W-1:0] ts_set_val,
    output reg  [TS_W-1:0] now
);

    localparam PCW = (PRESC <= 2) ? 1 : $clog2(PRESC);

    reg [PCW-1:0] pc;      // cycles since the last tick

    wire tick = !pause && (pc == PRESC - 1);

    always @(posedge clk) begin
        if (!rst_n) begin
            now <= {TS_W{1'b0}};
            pc  <= {PCW{1'b0}};
        end else if (ts_set) begin
            now <= ts_set_val;
            pc  <= {PCW{1'b0}};
        end else if (tick) begin
            now <= now + 1'b1;
            pc  <= {PCW{1'b0}};
        end else if (!pause) begin
            pc  <= pc + 1'b1;
        end
    end

endmodule

`default_nettype wire

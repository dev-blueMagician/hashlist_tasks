// txsched_timebase.v
//
// Time base of the transmit scheduler: the tick counter now, TS_W bits
// wide, wrapping. It advances by one every PRESC clock cycles in which
// pause is low. A ts_set cycle loads ts_set_val into the counter and
// restarts the prescaler, also while paused. See docs/txsched_spec.md,
// section 4.
//
// Rev B (ECR-0731): tick is also an output. In a cycle with ts_set low,
// now in the next cycle is now + tick; with ts_set high it is ts_set_val.
// The launch-time logic in txsched.v judges each scheduled frame against
// the value now will have in the cycle the frame would appear.

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
    output reg  [TS_W-1:0] now,
    output wire            tick     // now advances at the end of this cycle, unless ts_set
);

    localparam PCW = (PRESC <= 2) ? 1 : $clog2(PRESC);

    reg [PCW-1:0] pc;      // cycles since the last tick

    assign tick = !pause && (pc == PRESC - 1);

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

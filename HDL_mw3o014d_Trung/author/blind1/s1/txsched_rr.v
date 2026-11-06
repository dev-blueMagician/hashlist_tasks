// txsched_rr.v
//
// Round-robin channel picker for the transmit scheduler. Given the
// channels that offer a frame (req) and the channel served last (last),
// it picks the first requesting channel after last, wrapping at NCH.
// Purely combinational.
//
// The file also holds txsched_lt_pick, the earliest-launch-time picker for
// scheduled frames (rev B, ECR-0731).

`timescale 1ns / 1ps
`default_nettype none

module txsched_rr #(
    parameter NCH = 4
) (
    input  wire [NCH-1:0] req,
    input  wire [2:0]     last,
    output reg            any,
    output reg  [2:0]     idx
);

    integer k;
    integer c;

    // Walk from the farthest channel back to the nearest one, so the
    // nearest requesting channel after last is the one left in idx.
    always @* begin
        any = 1'b0;
        idx = 3'd0;
        for (k = NCH; k >= 1; k = k - 1) begin
            c = last + k;
            if (c >= NCH)
                c = c - NCH;
            if (req[c]) begin
                any = 1'b1;
                idx = c[2:0];
            end
        end
    end

endmodule

// txsched_lt_pick
//
// Launch-time picker (rev B, ECR-0731). Among the channels whose head is a
// scheduled frame that may be taken (req), it picks the one with the
// largest lateness, lat = ticks after its launch time at which it would
// appear, i.e. the earliest launch time. Every lat given with req set is
// in 0 .. LATE_WIN - 1, so an unsigned compare orders them. Equal values
// go in round-robin order after last. Purely combinational.

module txsched_lt_pick #(
    parameter NCH  = 4,
    parameter TS_W = 32
) (
    input  wire [NCH-1:0]      req,
    input  wire [NCH*TS_W-1:0] lat,
    input  wire [2:0]          last,
    output reg                 any,
    output reg  [2:0]          idx
);

    integer k;
    integer c;
    reg [TS_W-1:0] best;

    // Walk from the nearest channel after last to the farthest one; a
    // later channel replaces the choice only with a strictly larger lat.
    always @* begin
        any  = 1'b0;
        idx  = 3'd0;
        best = {TS_W{1'b0}};
        for (k = 1; k <= NCH; k = k + 1) begin
            c = last + k;
            if (c >= NCH)
                c = c - NCH;
            if (req[c] && (!any || lat[c*TS_W +: TS_W] > best)) begin
                any  = 1'b1;
                idx  = c[2:0];
                best = lat[c*TS_W +: TS_W];
            end
        end
    end

endmodule

`default_nettype wire

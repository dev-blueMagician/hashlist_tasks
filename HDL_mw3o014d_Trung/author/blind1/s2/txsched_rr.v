// txsched_rr.v
//
// Channel pickers for the transmit scheduler. Purely combinational.
//
// txsched_rr: given the channels that offer a frame (req) and the channel
// served last (last), it picks the first requesting channel after last,
// wrapping at NCH.
//
// txsched_lt_pick (rev B, ECR-0731): given the channels whose head is a
// scheduled frame that may be taken (req) and, for each, how many ticks
// after its launch time it would appear (lag, NCH fields of LW bits), it
// picks the channel with the largest lag, that is the earliest launch
// time. Equal lags go to the first such channel after last, wrapping at
// NCH, as in txsched_rr.

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

module txsched_lt_pick #(
    parameter NCH = 4,
    parameter LW  = 33
) (
    input  wire [NCH-1:0]    req,
    input  wire [NCH*LW-1:0] lag,
    input  wire [2:0]        last,
    output reg               any,
    output reg  [2:0]        idx
);

    integer k;
    integer c;
    reg [LW-1:0] best;
    reg [LW-1:0] cur;

    // Walk in round-robin order from the channel after last. A channel
    // replaces the current choice only with a strictly larger lag, so
    // among equal lags the one nearest after last is kept.
    always @* begin
        any  = 1'b0;
        idx  = 3'd0;
        best = {LW{1'b0}};
        for (k = 1; k <= NCH; k = k + 1) begin
            c = last + k;
            if (c >= NCH)
                c = c - NCH;
            cur = lag[c*LW +: LW];
            if (req[c] && (!any || cur > best)) begin
                any  = 1'b1;
                idx  = c[2:0];
                best = cur;
            end
        end
    end

endmodule

`default_nettype wire

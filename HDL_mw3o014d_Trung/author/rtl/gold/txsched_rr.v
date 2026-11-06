// txsched_rr.v
//
// Channel pickers for the transmit scheduler. Purely combinational.
//
// txsched_rr: given the channels that offer a frame (req) and the channel
// served last (last), picks the first requesting channel after last,
// wrapping at NCH.
//
// txsched_edf: among the requesting channels, picks the one with the
// largest key; equal keys go to the first of them after last. The
// scheduler's key is how many ticks a frame's launch time lies behind the
// time it would appear, so the largest key is the earliest launch time.

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

module txsched_edf #(
    parameter NCH = 4,
    parameter KW  = 32
) (
    input  wire [NCH-1:0]    req,
    input  wire [NCH*KW-1:0] key,
    input  wire [2:0]        last,
    output reg               any,
    output reg  [2:0]        idx
);

    integer k;
    integer c;
    reg [KW-1:0] best;

    // Walk in round-robin order from the channel after last; only a
    // strictly larger key replaces the one held, so ties keep the
    // channel met first.
    always @* begin
        any  = 1'b0;
        idx  = 3'd0;
        best = {KW{1'b0}};
        for (k = 1; k <= NCH; k = k + 1) begin
            c = last + k;
            if (c >= NCH)
                c = c - NCH;
            if (req[c] && (!any || key[c*KW +: KW] > best)) begin
                any  = 1'b1;
                idx  = c[2:0];
                best = key[c*KW +: KW];
            end
        end
    end

endmodule

`default_nettype wire

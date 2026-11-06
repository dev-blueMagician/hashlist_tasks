// txsched_rr.v
//
// Channel picker for the transmit scheduler. Scheduled candidates (sreq)
// win over best-effort candidates (breq). Among scheduled ones the largest
// age (ticks past launch time) wins; equal ages go round robin, first
// channel after last. Best-effort candidates go round robin. Combinational.

`timescale 1ns / 1ps
`default_nettype none

module txsched_rr #(
    parameter NCH  = 4,
    parameter TS_W = 32
) (
    input  wire [NCH-1:0]      sreq,
    input  wire [NCH-1:0]      breq,
    input  wire [NCH*TS_W-1:0] age,
    input  wire [2:0]          last,
    output reg                 any,
    output reg  [2:0]          idx
);

    integer k;
    integer c;
    reg              s_any;
    reg [TS_W-1:0]   best;

    // Walk from the farthest channel back to the nearest one, so on equal
    // ages the nearest channel after last is the one left in idx.
    always @* begin
        any   = 1'b0;
        idx   = 3'd0;
        s_any = 1'b0;
        best  = {TS_W{1'b0}};
        c     = 0;
        for (k = NCH; k >= 1; k = k - 1) begin
            c = last + k;
            if (c >= NCH)
                c = c - NCH;
            if (sreq[c] && (!s_any || age[c*TS_W +: TS_W] >= best)) begin
                s_any = 1'b1;
                best  = age[c*TS_W +: TS_W];
                idx   = c[2:0];
            end
        end
        any = s_any;
        if (!s_any) begin
            for (k = NCH; k >= 1; k = k - 1) begin
                c = last + k;
                if (c >= NCH)
                    c = c - NCH;
                if (breq[c]) begin
                    any = 1'b1;
                    idx = c[2:0];
                end
            end
        end
    end

endmodule

`default_nettype wire

// txsched.v
//
// Transmit scheduler, rev A. Frames arrive on one enqueue port, tagged
// with a channel, and wait in one FIFO per channel. A round-robin picker
// moves one head frame per cycle into a registered output stage that
// feeds the MAC on a valid/ready interface. The tick counter now stamps
// each frame with the time it was taken (out_gts).
//
// Block behaviour: docs/txsched_spec.md.
//
// Files: txsched.v (this top level), txsched_timebase.v (the tick
// counter), txsched_fifo.v (a channel queue), txsched_rr.v (the
// round-robin picker).
//
// in_lt_en, in_lt, LATE_WIN, late_mask and late_cnt are reserved for
// launch-time scheduling (spec section 8). Rev A ignores the inputs and
// drives the outputs to zero.

`timescale 1ns / 1ps
`default_nettype none

module txsched #(
    parameter NCH      = 4,     // channels, 2 to 8
    parameter DW       = 16,    // frame descriptor width, 1 to 32
    parameter DEPTH    = 4,     // frames per channel queue, 2 to 16
    parameter TS_W     = 32,    // tick counter width, 8 to 32
    parameter PRESC    = 1,     // clock cycles per tick, 1 to 16
    parameter LATE_WIN = 64     // reserved (spec section 8)
) (
    input  wire              clk,
    input  wire              rst_n,

    // enqueue
    input  wire              in_valid,
    output wire              in_ready,
    input  wire [2:0]        in_ch,
    input  wire [DW-1:0]     in_data,
    input  wire              in_lt_en,      // reserved
    input  wire [TS_W-1:0]   in_lt,         // reserved

    // output stage, to the MAC
    output reg               out_valid,
    input  wire              out_ready,
    output reg  [2:0]        out_ch,
    output reg  [DW-1:0]     out_data,
    output reg  [TS_W-1:0]   out_gts,

    // time base
    input  wire              pause,
    input  wire              ts_set,
    input  wire [TS_W-1:0]   ts_set_val,
    output wire [TS_W-1:0]   now,

    // status
    output reg  [NCH-1:0]    late_mask,     // reserved, 0
    output reg  [15:0]       late_cnt       // reserved, 0
);

    // ------------------------------------------------------------ time base

    wire [TS_W-1:0] now_nxt;

    txsched_timebase #(
        .TS_W  (TS_W),
        .PRESC (PRESC)
    ) u_time (
        .clk        (clk),
        .rst_n      (rst_n),
        .pause      (pause),
        .ts_set     (ts_set),
        .ts_set_val (ts_set_val),
        .now        (now),
        .now_nxt    (now_nxt)
    );

    // ------------------------------------------------------- channel queues

    localparam NW = DW + 1 + TS_W;      // {lt, lt_en, data}

    wire [NCH-1:0]    q_empty;
    wire [NCH-1:0]    q_full;
    wire [NCH-1:0]    q_push;
    wire [NCH-1:0]    q_pop;
    wire [NCH*NW-1:0] q_head;

    assign in_ready = (in_ch < NCH) && !q_full[in_ch];

    // per channel: scheduled head state, judged for the next cycle
    wire [NCH-1:0]       h_sched;   // head is a scheduled frame
    wire [NCH-1:0]       h_late;    // head would be late: drop
    wire [NCH-1:0]       h_elig;    // scheduled head that may be taken
    wire [NCH*TS_W-1:0]  h_age;     // ticks after launch if it appeared next cycle

    genvar g;
    generate
        for (g = 0; g < NCH; g = g + 1) begin : g_ch
            assign q_push[g] = in_valid && in_ready && (in_ch == g);

            txsched_fifo #(
                .W     (NW),
                .DEPTH (DEPTH)
            ) u_q (
                .clk       (clk),
                .rst_n     (rst_n),
                .push      (q_push[g]),
                .push_data ({in_lt, in_lt_en, in_data}),
                .pop       (q_pop[g]),
                .head      (q_head[g*NW +: NW]),
                .empty     (q_empty[g]),
                .full      (q_full[g])
            );

            wire [TS_W-1:0] lt  = q_head[g*NW + DW + 1 +: TS_W];
            wire [TS_W-1:0] age = now_nxt - lt;
            wire            ok  = !q_empty[g] && q_head[g*NW + DW];
            wire            fut = age[TS_W-1];
            wire            lat = !fut && (age >= LATE_WIN);

            assign h_sched[g]            = ok;
            assign h_late[g]             = ok && lat;
            assign h_elig[g]             = ok && !fut && !lat;
            assign h_age[g*TS_W +: TS_W] = age;
        end
    endgenerate

    // ---------------------------------------------------------- arbitration

    reg  [2:0] rr_last;     // channel taken last
    wire       be_any, lt_any;
    wire [2:0] be_idx, lt_idx;

    txsched_lt_pick #(
        .NCH  (NCH),
        .TS_W (TS_W)
    ) u_lt (
        .req  (h_elig),
        .age  (h_age),
        .last (rr_last),
        .any  (lt_any),
        .idx  (lt_idx)
    );

    txsched_rr #(
        .NCH (NCH)
    ) u_rr (
        .req  (~q_empty & ~h_sched),
        .last (rr_last),
        .any  (be_any),
        .idx  (be_idx)
    );

    wire [2:0] pick_idx = lt_any ? lt_idx : be_idx;
    wire       pick_any = lt_any | be_any;

    // The stage takes a frame at the end of a cycle in which it is free
    // (empty, or its frame is being accepted) and pause is low.
    wire stage_free = !out_valid || out_ready;
    wire take       = stage_free && !pause && pick_any;
    wire [NCH-1:0] drop = pause ? {NCH{1'b0}} : h_late;

    generate
        for (g = 0; g < NCH; g = g + 1) begin : g_pop
            assign q_pop[g] = (take && (pick_idx == g)) || drop[g];
        end
    endgenerate

    // --------------------------------------------------------- output stage

    always @(posedge clk) begin
        if (!rst_n) begin
            out_valid <= 1'b0;
            rr_last   <= NCH - 1;
        end else if (stage_free) begin
            out_valid <= take;
            if (take) begin
                out_ch   <= pick_idx;
                out_data <= q_head[pick_idx*NW +: DW];
                out_gts  <= now;
                rr_last  <= pick_idx;
            end
        end
    end

    // ---------------------------------------------------------------- status

    integer n;
    reg [4:0] ndrop;
    always @* begin
        ndrop = 5'd0;
        for (n = 0; n < NCH; n = n + 1)
            ndrop = ndrop + {4'd0, drop[n]};
    end

    always @(posedge clk) begin
        if (!rst_n) begin
            late_mask <= {NCH{1'b0}};
            late_cnt  <= 16'd0;
        end else begin
            late_mask <= drop;
            late_cnt  <= late_cnt + {11'd0, ndrop};
        end
    end

endmodule

`default_nettype wire

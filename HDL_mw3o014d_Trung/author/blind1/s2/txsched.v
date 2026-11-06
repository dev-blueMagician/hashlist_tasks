// txsched.v
//
// Transmit scheduler, rev B. Frames arrive on one enqueue port, tagged
// with a channel, and wait in one FIFO per channel. A picker moves one
// head frame per cycle into a registered output stage that feeds the MAC
// on a valid/ready interface. The tick counter now stamps each frame with
// the time it was taken (out_gts).
//
// Block behaviour: docs/txsched_spec.md (rev A) as changed by
// docs/ECR-0731_launch_time.md (rev B, launch-time scheduling).
//
// Files: txsched.v (this top level), txsched_timebase.v (the tick
// counter), txsched_fifo.v (a channel queue), txsched_rr.v (the
// round-robin picker and the launch-time picker).
//
// Rev B: a frame queued with in_lt_en high is scheduled, with launch time
// in_lt. Each queue entry holds {lt_en, lt, data}. For a scheduled head,
// lag is how many ticks after its launch time the frame would appear if
// taken now, measured against the value of now in the next cycle, on the
// wrapping counter (signed, TS_W + 1 bits so the step of now cannot
// overflow it):
//   lag < 0              not due: the channel is blocked
//   0 <= lag < LATE_WIN  due: may be taken, earliest launch time first
//   lag >= LATE_WIN      late: dropped at the end of the cycle (pause low)
// Best-effort heads are taken round robin only if no scheduled frame may
// be taken.

`timescale 1ns / 1ps
`default_nettype none

module txsched #(
    parameter NCH      = 4,     // channels, 2 to 8
    parameter DW       = 16,    // frame descriptor width, 1 to 32
    parameter DEPTH    = 4,     // frames per channel queue, 2 to 16
    parameter TS_W     = 32,    // tick counter width, 8 to 32
    parameter PRESC    = 1,     // clock cycles per tick, 1 to 16
    parameter LATE_WIN = 64     // late window in ticks, 1 to 2^(TS_W-2)
) (
    input  wire              clk,
    input  wire              rst_n,

    // enqueue
    input  wire              in_valid,
    output wire              in_ready,
    input  wire [2:0]        in_ch,
    input  wire [DW-1:0]     in_data,
    input  wire              in_lt_en,      // scheduled frame
    input  wire [TS_W-1:0]   in_lt,         // its launch time

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
    output reg  [NCH-1:0]    late_mask,     // channels that dropped a frame last cycle
    output reg  [15:0]       late_cnt       // frames dropped, wrapping
);

    localparam QW = DW + TS_W + 1;          // queue entry {lt_en, lt, data}
    localparam LW = TS_W + 1;               // signed lag width
    localparam [LW-1:0] LWIN = LATE_WIN;

    // ------------------------------------------------------------ time base

    wire tb_tick;

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
        .tick       (tb_tick)
    );

    // ------------------------------------------------------- channel queues

    wire [NCH-1:0]    q_empty;
    wire [NCH-1:0]    q_full;
    wire [NCH-1:0]    q_push;
    wire [NCH-1:0]    q_pop;
    wire [NCH*QW-1:0] q_head;

    wire [NCH-1:0]    be_req;   // head is best-effort
    wire [NCH-1:0]    lt_req;   // head is scheduled and may be taken
    wire [NCH-1:0]    lt_late;  // head is scheduled and late
    wire [NCH*LW-1:0] lt_lag;

    wire [QW-1:0] in_entry = {in_lt_en, (in_lt_en ? in_lt : {TS_W{1'b0}}), in_data};

    assign in_ready = (in_ch < NCH) && !q_full[in_ch];

    genvar g;
    generate
        for (g = 0; g < NCH; g = g + 1) begin : g_ch
            assign q_push[g] = in_valid && in_ready && (in_ch == g);

            txsched_fifo #(
                .W     (QW),
                .DEPTH (DEPTH)
            ) u_q (
                .clk       (clk),
                .rst_n     (rst_n),
                .push      (q_push[g]),
                .push_data (in_entry),
                .pop       (q_pop[g]),
                .head      (q_head[g*QW +: QW]),
                .empty     (q_empty[g]),
                .full      (q_full[g])
            );

            wire            h_en = q_head[g*QW + QW - 1];
            wire [TS_W-1:0] h_lt = q_head[g*QW + DW +: TS_W];

            // Ticks after the launch time, against now in the next cycle.
            wire [TS_W-1:0] d_set = ts_set_val - h_lt;
            wire [TS_W-1:0] d_now = now - h_lt;
            wire [LW-1:0]   lag   = ts_set ? {d_set[TS_W-1], d_set}
                                           : {d_now[TS_W-1], d_now} + {{(LW-1){1'b0}}, tb_tick};
            wire            due   = !lag[LW-1];

            assign lt_lag[g*LW +: LW] = lag;
            assign be_req[g]  = !q_empty[g] && !h_en;
            assign lt_req[g]  = !q_empty[g] &&  h_en && due && (lag <  LWIN);
            assign lt_late[g] = !q_empty[g] &&  h_en && due && (lag >= LWIN);
        end
    endgenerate

    // ---------------------------------------------------------- arbitration

    reg  [2:0] rr_last;     // channel taken last
    wire       be_any, lt_any;
    wire [2:0] be_idx, lt_idx;

    txsched_rr #(
        .NCH (NCH)
    ) u_rr (
        .req  (be_req),
        .last (rr_last),
        .any  (be_any),
        .idx  (be_idx)
    );

    txsched_lt_pick #(
        .NCH (NCH),
        .LW  (LW)
    ) u_lt (
        .req  (lt_req),
        .lag  (lt_lag),
        .last (rr_last),
        .any  (lt_any),
        .idx  (lt_idx)
    );

    wire       pick_any = lt_any || be_any;
    wire [2:0] pick_idx = lt_any ? lt_idx : be_idx;

    // The stage takes a frame at the end of a cycle in which it is free
    // (empty, or its frame is being accepted) and pause is low. Late heads
    // are dropped at the end of every cycle with pause low; a late head is
    // never one that may be taken, so a channel never takes and drops in
    // the same cycle.
    wire stage_free = !out_valid || out_ready;
    wire take       = stage_free && !pause && pick_any;
    wire [NCH-1:0] drop = pause ? {NCH{1'b0}} : lt_late;

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
                out_data <= q_head[pick_idx*QW +: DW];
                out_gts  <= now;
                rr_last  <= pick_idx;
            end
        end
    end

    // ---------------------------------------------------------------- status

    reg [3:0] drop_n;
    integer   j;

    always @* begin
        drop_n = 4'd0;
        for (j = 0; j < NCH; j = j + 1)
            drop_n = drop_n + {3'd0, drop[j]};
    end

    always @(posedge clk) begin
        if (!rst_n) begin
            late_mask <= {NCH{1'b0}};
            late_cnt  <= 16'd0;
        end else begin
            late_mask <= drop;
            late_cnt  <= late_cnt + {12'd0, drop_n};
        end
    end

endmodule

`default_nettype wire

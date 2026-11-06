// txsched.v
//
// Transmit scheduler, rev B. Frames arrive on one enqueue port, tagged
// with a channel, and wait in one FIFO per channel. Each cycle one head
// frame moves into a registered output stage that feeds the MAC on a
// valid/ready interface. The tick counter now stamps each frame with the
// time it was taken (out_gts).
//
// Block behaviour: docs/txsched_spec.md, with launch-time scheduling from
// docs/ECR-0731_launch_time.md:
//
// - A frame queued with in_lt_en high is a scheduled frame with launch
//   time in_lt; one queued with in_lt_en low is best effort (rev A).
// - A scheduled head may be taken when it would appear (next cycle) at or
//   after its launch time and less than LATE_WIN ticks after it. Until
//   then it blocks its channel.
// - Scheduled frames that may be taken go first, earliest launch time
//   first, ties in round-robin order; otherwise best effort round robin.
// - In every cycle with pause low, a channel whose scheduled head would
//   appear LATE_WIN or more ticks late drops it (late_mask, late_cnt).
//
// All launch-time comparisons are on the wrapping counter: the difference
// now_nxt - lt is read as a signed TS_W-bit value (ECR section 5).
//
// Files: txsched.v (this top level), txsched_timebase.v (the tick
// counter), txsched_fifo.v (a channel queue), txsched_rr.v (the
// round-robin picker and the launch-time picker).

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
    output reg  [NCH-1:0]    late_mask,     // channels that dropped a frame
    output reg  [15:0]       late_cnt       // frames dropped, wrapping
);

    // Queue entry: {scheduled, launch time, descriptor}.
    localparam QW = DW + TS_W + 1;
    localparam [TS_W-1:0] LW = LATE_WIN;

    // ------------------------------------------------------------ time base

    wire [TS_W-1:0] now_nxt;    // value of now in the next cycle

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

    wire [NCH-1:0]      q_empty;
    wire [NCH-1:0]      q_full;
    wire [NCH-1:0]      q_push;
    wire [NCH-1:0]      q_pop;
    wire [NCH*QW-1:0]   q_head;

    wire [NCH*DW-1:0]   h_data;     // head descriptor
    wire [NCH*TS_W-1:0] h_lat;      // now_nxt - head launch time
    wire [NCH-1:0]      h_be;       // head is a best-effort frame
    wire [NCH-1:0]      h_due;      // head is scheduled and may be taken
    wire [NCH-1:0]      h_late;     // head is scheduled and late
    wire [NCH-1:0]      drop;       // drop the head at the end of this cycle

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
                .push_data ({in_lt_en, in_lt, in_data}),
                .pop       (q_pop[g]),
                .head      (q_head[g*QW +: QW]),
                .empty     (q_empty[g]),
                .full      (q_full[g])
            );

            wire            sched = q_head[g*QW + QW - 1];
            wire [TS_W-1:0] lt    = q_head[g*QW + DW +: TS_W];
            wire [TS_W-1:0] lat   = now_nxt - lt;
            // lat is read as signed: the sign bit set means the launch
            // time is still ahead of the tick the frame would appear at.
            wire            ahead = lat[TS_W-1];

            assign h_data[g*DW +: DW]     = q_head[g*QW +: DW];
            assign h_lat[g*TS_W +: TS_W]  = lat;
            assign h_be[g]   = !q_empty[g] && !sched;
            assign h_due[g]  = !q_empty[g] &&  sched && !ahead && (lat <  LW);
            assign h_late[g] = !q_empty[g] &&  sched && !ahead && (lat >= LW);
            assign drop[g]   = !pause && h_late[g];
        end
    endgenerate

    // ---------------------------------------------------------- arbitration

    reg  [2:0] rr_last;     // channel taken last, of either kind
    wire       be_any;
    wire [2:0] be_idx;
    wire       lt_any;
    wire [2:0] lt_idx;

    txsched_rr #(
        .NCH (NCH)
    ) u_rr (
        .req  (h_be),
        .last (rr_last),
        .any  (be_any),
        .idx  (be_idx)
    );

    txsched_lt_pick #(
        .NCH  (NCH),
        .TS_W (TS_W)
    ) u_lt (
        .req  (h_due),
        .lat  (h_lat),
        .last (rr_last),
        .any  (lt_any),
        .idx  (lt_idx)
    );

    wire       pick_any = lt_any || be_any;
    wire [2:0] pick_idx = lt_any ? lt_idx : be_idx;

    // The stage takes a frame at the end of a cycle in which it is free
    // (empty, or its frame is being accepted) and pause is low.
    wire stage_free = !out_valid || out_ready;
    wire take       = stage_free && !pause && pick_any;

    // A late head is never due, so a channel never drops and is taken
    // from in the same cycle.
    generate
        for (g = 0; g < NCH; g = g + 1) begin : g_pop
            assign q_pop[g] = drop[g] || (take && (pick_idx == g));
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
                out_data <= h_data[pick_idx*DW +: DW];
                out_gts  <= now;
                rr_last  <= pick_idx;
            end
        end
    end

    // ---------------------------------------------------------------- status

    integer i;
    reg [3:0] n_drop;

    always @* begin
        n_drop = 4'd0;
        for (i = 0; i < NCH; i = i + 1)
            n_drop = n_drop + drop[i];
    end

    always @(posedge clk) begin
        if (!rst_n) begin
            late_mask <= {NCH{1'b0}};
            late_cnt  <= 16'd0;
        end else begin
            late_mask <= drop;
            late_cnt  <= late_cnt + {12'd0, n_drop};
        end
    end

endmodule

`default_nettype wire

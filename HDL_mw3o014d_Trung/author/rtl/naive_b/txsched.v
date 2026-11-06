// txsched.v
//
// Transmit scheduler, rev B (ECR-0731, launch-time scheduling). Frames
// arrive on one enqueue port, tagged with a channel, and wait in one FIFO
// per channel. One head frame per cycle moves into a registered output
// stage that feeds the MAC on a valid/ready interface. The tick counter
// now stamps each frame with the time it was taken (out_gts).
//
// A frame queued with in_lt_en carries a launch time: it may not appear
// on the output before now reaches it, it goes ahead of best-effort
// frames, earliest launch time first, and it is dropped if it would
// appear LATE_WIN or more ticks late.
//
// Block behaviour: docs/txsched_spec.md and docs/ECR-0731_launch_time.md.
//
// Files: txsched.v (this top level), txsched_timebase.v (the tick
// counter), txsched_fifo.v (a channel queue), txsched_rr.v (the channel
// pickers).

`timescale 1ns / 1ps
`default_nettype none

module txsched #(
    parameter NCH      = 4,     // channels, 2 to 8
    parameter DW       = 16,    // frame descriptor width, 1 to 32
    parameter DEPTH    = 4,     // frames per channel queue, 2 to 16
    parameter TS_W     = 32,    // tick counter width, 8 to 32
    parameter PRESC    = 1,     // clock cycles per tick, 1 to 16
    parameter LATE_WIN = 64     // ticks after its launch time a frame is late
) (
    input  wire              clk,
    input  wire              rst_n,

    // enqueue
    input  wire              in_valid,
    output wire              in_ready,
    input  wire [2:0]        in_ch,
    input  wire [DW-1:0]     in_data,
    input  wire              in_lt_en,
    input  wire [TS_W-1:0]   in_lt,

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
    output reg  [NCH-1:0]    late_mask,
    output reg  [15:0]       late_cnt
);

    localparam FW = 1 + TS_W + DW;      // queue entry: {lt_en, lt, data}

    // ------------------------------------------------------------ time base

    wire [TS_W-1:0] now_next;

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
        .now_next   (now_next)
    );

    // ------------------------------------------------------- channel queues

    wire [NCH-1:0]      q_empty;
    wire [NCH-1:0]      q_full;
    wire [NCH-1:0]      q_push;
    wire [NCH-1:0]      q_pop;
    wire [NCH*FW-1:0]   q_head;

    wire [NCH-1:0]      sc_ok;      // scheduled head that may appear next cycle
    wire [NCH-1:0]      be_ok;      // best-effort head
    wire [NCH-1:0]      drop;       // scheduled head that would be late next cycle
    wire [NCH*TS_W-1:0] lag;        // ticks the head's launch time lies behind now_next

    assign in_ready = (in_ch < NCH) && !q_full[in_ch];

    genvar g;
    generate
        for (g = 0; g < NCH; g = g + 1) begin : g_ch
            assign q_push[g] = in_valid && in_ready && (in_ch == g);

            txsched_fifo #(
                .W     (FW),
                .DEPTH (DEPTH)
            ) u_q (
                .clk       (clk),
                .rst_n     (rst_n),
                .push      (q_push[g]),
                .push_data ({in_lt_en, in_lt, in_data}),
                .pop       (q_pop[g]),
                .head      (q_head[g*FW +: FW]),
                .empty     (q_empty[g]),
                .full      (q_full[g])
            );

            wire            h_sc = q_head[g*FW + FW - 1];
            wire [TS_W-1:0] h_lt = q_head[g*FW + DW +: TS_W];

            // The counter wraps, and every queued launch time stays within
            // half its range of now, so the difference modulo 2^TS_W tells
            // before from after: below 2^(TS_W-1) means the launch time is
            // at or behind now_next by that many ticks.
            wire [TS_W-1:0] d    = now - h_lt;
            wire            due  = !d[TS_W-1];
            wire            late = due && (d >= LATE_WIN);

            assign lag[g*TS_W +: TS_W] = d;
            assign sc_ok[g] = !q_empty[g] && h_sc && due && !late;
            assign be_ok[g] = !q_empty[g] && !h_sc;
            assign drop[g]  = !pause && !q_empty[g] && h_sc && late;
        end
    endgenerate

    // ---------------------------------------------------------- arbitration

    reg  [2:0] rr_last;     // channel taken last, in either class
    wire       sc_any;
    wire [2:0] sc_idx;
    wire       be_any;
    wire [2:0] be_idx;

    txsched_edf #(
        .NCH (NCH),
        .KW  (TS_W)
    ) u_edf (
        .req  (sc_ok),
        .key  (lag),
        .last (rr_last),
        .any  (sc_any),
        .idx  (sc_idx)
    );

    txsched_rr #(
        .NCH (NCH)
    ) u_rr (
        .req  (be_ok),
        .last (rr_last),
        .any  (be_any),
        .idx  (be_idx)
    );

    wire       pick_any = sc_any || be_any;
    wire [2:0] pick_idx = sc_any ? sc_idx : be_idx;

    // The stage takes a frame at the end of a cycle in which it is free
    // (empty, or its frame is being accepted) and pause is low.
    wire stage_free = !out_valid || out_ready;
    wire take       = stage_free && !pause && pick_any;

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
                out_data <= q_head[pick_idx*FW +: DW];
                out_gts  <= now;
                rr_last  <= pick_idx;
            end
        end
    end

    // ---------------------------------------------------------------- status

    integer i;
    reg [4:0] n_drop;

    always @* begin
        n_drop = 5'd0;
        for (i = 0; i < NCH; i = i + 1)
            n_drop = n_drop + drop[i];
    end

    always @(posedge clk) begin
        if (!rst_n) begin
            late_mask <= {NCH{1'b0}};
            late_cnt  <= 16'd0;
        end else begin
            late_mask <= drop;
            late_cnt  <= late_cnt + n_drop;
        end
    end

endmodule

`default_nettype wire

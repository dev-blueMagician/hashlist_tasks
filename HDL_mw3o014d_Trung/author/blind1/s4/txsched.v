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

    localparam QW = DW + 1 + TS_W;
    localparam [TS_W-1:0] LW = LATE_WIN;

    wire [NCH-1:0]    q_empty;
    wire [NCH-1:0]    q_full;
    wire [NCH-1:0]    q_push;
    wire [NCH-1:0]    q_pop;
    wire [NCH*QW-1:0] q_head;

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
        end
    endgenerate

    // ----------------------------------------------- launch time per channel
    // Ages are measured at the value of now in the next cycle, the cycle
    // in which a frame taken now would appear.

    wire [NCH-1:0]      s_ok;     // scheduled head that may be taken
    wire [NCH-1:0]      b_ok;     // best-effort head
    wire [NCH-1:0]      s_late;   // scheduled head that is late
    wire [NCH*TS_W-1:0] s_age;

    generate
        for (g = 0; g < NCH; g = g + 1) begin : g_lt
            wire            h_en  = q_head[g*QW + DW + TS_W];
            wire [TS_W-1:0] h_lt  = q_head[g*QW + DW +: TS_W];
            wire [TS_W-1:0] h_age = now_nxt - h_lt;
            wire            h_due = !h_age[TS_W-1];
            assign s_age[g*TS_W +: TS_W] = h_age;
            assign s_late[g] = !q_empty[g] && h_en && h_due && (h_age >= LW);
            assign s_ok[g]   = !q_empty[g] && h_en && h_due && (h_age < LW);
            assign b_ok[g]   = !q_empty[g] && !h_en;
        end
    endgenerate

    // ---------------------------------------------------------- arbitration

    reg  [2:0] rr_last;     // channel taken last
    wire       pick_any;
    wire [2:0] pick_idx;

    txsched_rr #(
        .NCH  (NCH),
        .TS_W (TS_W)
    ) u_rr (
        .sreq (s_ok),
        .breq (b_ok),
        .age  (s_age),
        .last (rr_last),
        .any  (pick_any),
        .idx  (pick_idx)
    );

    wire stage_free = !out_valid || out_ready;
    wire take       = stage_free && !pause && pick_any;
    wire [NCH-1:0] drop = pause ? {NCH{1'b0}} : s_late;

    generate
        for (g = 0; g < NCH; g = g + 1) begin : g_pop
            assign q_pop[g] = (take && (pick_idx == g)) || drop[g];
        end
    endgenerate

    reg [4:0] drop_n;
    integer   di;
    always @* begin
        drop_n = 5'd0;
        for (di = 0; di < NCH; di = di + 1)
            drop_n = drop_n + drop[di];
    end

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

    always @(posedge clk) begin
        if (!rst_n) begin
            late_mask <= {NCH{1'b0}};
            late_cnt  <= 16'd0;
        end else begin
            late_mask <= drop;
            late_cnt  <= late_cnt + drop_n;
        end
    end

endmodule

`default_nettype wire

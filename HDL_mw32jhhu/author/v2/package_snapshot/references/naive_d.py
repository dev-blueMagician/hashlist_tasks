"""Partial feature: as gold, but the output queue keeps its 4 entries, so reads cannot run at one word per cycle."""
open("/app/data/pktbuf.v", "w").write(r'''// pktbuf.v
//
// Packet buffer between the line-side receive stream and the switch
// interface. Packets arrive on a valid/ready stream, are stored in an
// external synchronous SRAM, and leave on a second valid/ready stream.
// The block behaviour is specified in docs/pktbuf_spec.md.
//
// Board rev C: the SRAM is the NW61P1024 pipelined part with LAT strapped
// high (ECO-117): read latency 3, late write, and a write reaches the array
// two cycles after its command (docs/NW61P1024_excerpt.md).
//
// This file holds the top level: ingress, the packet descriptor queue,
// the SRAM command arbiter and the SRAM pins. The read pipeline and the
// output queue are in pktbuf_egress.v.

`timescale 1ns/1ps

module pktbuf #(
    parameter DW = 32,          // data width, also the SRAM word width
    parameter AW = 10           // SRAM address width, 2**AW words
) (
    input  wire          clk,
    input  wire          rst_n,           // asynchronous assert, active low

    input  wire          cfg_cut_through, // 0 store-and-forward, 1 cut-through

    // ingress stream
    input  wire          in_valid,
    output wire          in_ready,
    input  wire [DW-1:0] in_data,
    input  wire          in_last,
    input  wire          in_err,          // sampled with in_last only

    // egress stream
    output wire          out_valid,
    input  wire          out_ready,
    output wire [DW-1:0] out_data,
    output wire          out_last,
    output wire          out_err,

    // status
    output wire [15:0]   drop_count,

    // external SRAM, all outputs driven from flops
    output reg           sram_ce_n,
    output reg           sram_we_n,
    output reg  [AW-1:0] sram_addr,
    output reg  [DW-1:0] sram_wdata,
    input  wire [DW-1:0] sram_rdata
);

    localparam ND  = 8;                         // packet descriptor slots
    localparam NDW = 3;                         // log2(ND)
    localparam [AW:0] CAP = {1'b1, {AW{1'b0}}}; // 2**AW words

    // ------------------------------------------------------------------
    // Ingress
    // ------------------------------------------------------------------
    reg  [AW:0]    wr_ptr;      // address of the next word to write
    reg  [AW:0]    pkt_start;   // first address of the packet being received
    reg  [15:0]    drop_cnt;

    // Packet descriptor queue: the address of each packet's last word and
    // its error flag. In store-and-forward mode an entry means "this packet
    // is complete". In cut-through mode it only marks where a packet ends.
    reg  [AW-1:0]  desc_end [0:ND-1];
    reg            desc_err [0:ND-1];
    reg  [NDW-1:0] desc_wp;
    reg  [NDW-1:0] desc_rp;
    reg  [NDW:0]   desc_cnt;

    wire [AW:0]    rd_ptr;      // address of the next word to read (egress)
    wire           rd_want;     // egress asks for a read command this cycle
    wire           rd_go;       // ... and gets it
    wire           wr_go;       // an ingress beat is written this cycle
    reg            rr_rd;       // the read wins the next conflict

    // NW61P: a read returns a word's new contents only if the read command
    // is at least 3 cycles after the write command. The pins are flops, so a
    // write issued at edge e lets a read of the same address go at e+3: the
    // egress sees writes two cycles late.
    reg            wct_d1, wct_d2;        // cut-through SRAM-path writes, delayed
    reg  [AW:0]    safe_cnt;              // cut-through: words the egress may read
    reg            push_d1, push_d2;      // descriptor pushes two cycles ago
    reg  [NDW:0]   vis_cnt;               // descriptors the egress may use
    reg  [DW-1:0]  wdata_stage;           // late write: data follows the command

    // Cut-through bypass. Through the SRAM a word now needs at least 8 cycles
    // from ingress to egress, over the 5-cycle first-beat budget (spec 6.4).
    // When everything earlier has been read or sent and the output queue has
    // room, an ingress beat goes straight into the output queue. It is still
    // written to the SRAM, but never read back.
    wire           byp_ok;                // egress: no read in flight, queue has room
    wire           byp;

    wire [AW:0]    used       = wr_ptr - rd_ptr;
    wire           can_accept = (used != CAP) && (desc_cnt != ND);

    // One SRAM command per cycle. When ingress and egress both want the
    // SRAM, they take turns.
    assign in_ready = can_accept && !(rd_want && rr_rd);
    assign wr_go    = in_valid && in_ready;
    assign rd_go    = rd_want && !wr_go;

    assign byp      = wr_go && cfg_cut_through && (rd_ptr == wr_ptr) && byp_ok;

    wire pkt_drop = wr_go && in_last && in_err && !cfg_cut_through;
    wire pkt_push = wr_go && in_last && !pkt_drop && !byp;
    wire pkt_pop;

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            wr_ptr    <= {(AW+1){1'b0}};
            pkt_start <= {(AW+1){1'b0}};
            drop_cnt  <= 16'd0;
            rr_rd     <= 1'b0;
        end else begin
            if (pkt_drop) begin
                wr_ptr   <= pkt_start;          // forget the whole packet
                drop_cnt <= drop_cnt + 16'd1;
            end else if (wr_go) begin
                wr_ptr <= wr_ptr + 1'b1;
                if (in_last)
                    pkt_start <= wr_ptr + 1'b1;
            end

            if (wr_go && rd_want)
                rr_rd <= 1'b1;
            else if (rd_go && in_valid && can_accept)
                rr_rd <= 1'b0;
        end
    end

    // ------------------------------------------------------------------
    // Descriptor queue
    // ------------------------------------------------------------------
    always @(posedge clk) begin
        if (pkt_push) begin
            desc_end[desc_wp] <= wr_ptr[AW-1:0];
            desc_err[desc_wp] <= in_err;
        end
    end

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            desc_wp  <= {NDW{1'b0}};
            desc_rp  <= {NDW{1'b0}};
            desc_cnt <= {(NDW+1){1'b0}};
        end else begin
            if (pkt_push)
                desc_wp <= desc_wp + 1'b1;
            if (pkt_pop)
                desc_rp <= desc_rp + 1'b1;
            case ({pkt_push, pkt_pop})
                2'b10:   desc_cnt <= desc_cnt + 1'b1;
                2'b01:   desc_cnt <= desc_cnt - 1'b1;
                default: desc_cnt <= desc_cnt;
            endcase
        end
    end

    // What the egress may read next.
    wire head_valid = (desc_cnt != 0);
    wire rd_last    = head_valid && (rd_ptr[AW-1:0] == desc_end[desc_rp]);
    wire rd_err     = desc_err[desc_rp];

    // Store-and-forward: only words of complete packets whose last write is
    // old enough. Cut-through: only words written at least 3 commands ago
    // (bypassed words are never read).
    wire rd_avail   = cfg_cut_through ? (safe_cnt != 0) : (vis_cnt != 0);

    assign pkt_pop  = rd_go && rd_last;

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            wct_d1    <= 1'b0;
            wct_d2    <= 1'b0;
            safe_cnt  <= {(AW+1){1'b0}};
            push_d1   <= 1'b0;
            push_d2   <= 1'b0;
            vis_cnt   <= {(NDW+1){1'b0}};
        end else begin
            wct_d1    <= wr_go && cfg_cut_through && !byp;
            wct_d2    <= wct_d1;
            case ({wct_d2, rd_go && cfg_cut_through})
                2'b10:   safe_cnt <= safe_cnt + 1'b1;
                2'b01:   safe_cnt <= safe_cnt - 1'b1;
                default: safe_cnt <= safe_cnt;
            endcase
            push_d1   <= pkt_push;
            push_d2   <= push_d1;
            case ({push_d2, pkt_pop})
                2'b10:   vis_cnt <= vis_cnt + 1'b1;
                2'b01:   vis_cnt <= vis_cnt - 1'b1;
                default: vis_cnt <= vis_cnt;
            endcase
        end
    end

    // ------------------------------------------------------------------
    // SRAM pins
    // ------------------------------------------------------------------
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            sram_ce_n <= 1'b1;
            sram_we_n <= 1'b1;
        end else begin
            sram_ce_n <= !(wr_go || rd_go);
            sram_we_n <= !wr_go;
        end
    end

    always @(posedge clk) begin
        if (wr_go) begin
            sram_addr   <= wr_ptr[AW-1:0];
            wdata_stage <= in_data;
        end else if (rd_go) begin
            sram_addr   <= rd_ptr[AW-1:0];
        end
        sram_wdata <= wdata_stage;      // on the pins one cycle after the command
    end

    assign drop_count = drop_cnt;

    // ------------------------------------------------------------------
    // Egress
    // ------------------------------------------------------------------
    pktbuf_egress #(.DW(DW), .AW(AW)) u_egress (
        .clk        (clk),
        .rst_n      (rst_n),
        .rd_avail   (rd_avail),
        .rd_last    (rd_last),
        .rd_err     (rd_err),
        .rd_go      (rd_go),
        .byp        (byp),
        .byp_data   (in_data),
        .byp_last   (in_last),
        .byp_err    (in_err),
        .byp_ok     (byp_ok),
        .rd_want    (rd_want),
        .rd_ptr     (rd_ptr),
        .sram_rdata (sram_rdata),
        .out_valid  (out_valid),
        .out_ready  (out_ready),
        .out_data   (out_data),
        .out_last   (out_last),
        .out_err    (out_err)
    );

endmodule
''')
open("/app/data/pktbuf_egress.v", "w").write(r'''// pktbuf_egress.v
//
// Egress half of pktbuf: issues SRAM reads in address order, follows each
// read through the SRAM, and queues the returned words for the egress
// stream. See docs/pktbuf_spec.md.
//
// Board rev C (NW61P1024, LAT high: read data 3 cycles after the command).

`timescale 1ns/1ps

module pktbuf_egress #(
    parameter DW = 32,
    parameter AW = 10
) (
    input  wire          clk,
    input  wire          rst_n,

    input  wire          rd_avail,    // the word at rd_ptr may be read
    input  wire          rd_last,     // ... and is the last of its packet
    input  wire          rd_err,      // ... and that packet had in_err
    input  wire          rd_go,       // the arbiter issues the read this cycle
    input  wire          byp,         // cut-through bypass: queue the ingress beat
    input  wire [DW-1:0] byp_data,
    input  wire          byp_last,
    input  wire          byp_err,
    output wire          byp_ok,      // a bypass may happen this cycle
    output wire          rd_want,
    output reg  [AW:0]   rd_ptr,

    input  wire [DW-1:0] sram_rdata,

    output wire          out_valid,
    input  wire          out_ready,
    output wire [DW-1:0] out_data,
    output wire          out_last,
    output wire          out_err
);

    localparam QD = 4;      // output queue entries
    localparam QW = 2;      // log2(QD)

    // Read pipeline, NW61P with LAT high:
    //   rd_p0  the read command is on the SRAM pins
    //   rd_p1  the SRAM sampled it at this edge (command edge)
    //   rd_p3  data is on sram_rdata and is captured at the next edge,
    //          command edge + 3
    reg rd_p0, rd_p1, rd_p2, rd_p3;
    reg tag_last0, tag_last1, tag_last2, tag_last3;
    reg tag_err0,  tag_err1,  tag_err2,  tag_err3;

    reg [DW-1:0] q_data [0:QD-1];
    reg          q_last [0:QD-1];
    reg          q_err  [0:QD-1];
    reg [QW-1:0] q_wp;
    reg [QW-1:0] q_rp;
    reg [QW:0]   q_cnt;

    wire [QW:0] in_flight = {{QW{1'b0}}, rd_p0} + {{QW{1'b0}}, rd_p1}
                          + {{QW{1'b0}}, rd_p2} + {{QW{1'b0}}, rd_p3};
    wire        q_push    = rd_p3 || byp;     // never both: byp needs no read in flight
    wire        q_pop     = out_valid && out_ready;

    // Ask for a read only when its data is sure to find a free entry.
    assign rd_want = rd_avail && ((q_cnt + in_flight) < QD);
    assign byp_ok  = (in_flight == 0) && (q_cnt < QD);

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            rd_ptr <= {(AW+1){1'b0}};
            rd_p0  <= 1'b0;
            rd_p1  <= 1'b0;
            rd_p2  <= 1'b0;
            rd_p3  <= 1'b0;
        end else begin
            if (rd_go || byp)
                rd_ptr <= rd_ptr + 1'b1;
            rd_p0 <= rd_go;
            rd_p1 <= rd_p0;
            rd_p2 <= rd_p1;
            rd_p3 <= rd_p2;
        end
    end

    always @(posedge clk) begin
        tag_last0 <= rd_last;
        tag_err0  <= rd_err;
        tag_last1 <= tag_last0;
        tag_err1  <= tag_err0;
        tag_last2 <= tag_last1;
        tag_err2  <= tag_err1;
        tag_last3 <= tag_last2;
        tag_err3  <= tag_err2;
    end

    always @(posedge clk) begin
        if (byp) begin
            q_data[q_wp] <= byp_data;
            q_last[q_wp] <= byp_last;
            q_err[q_wp]  <= byp_err && byp_last;
        end else if (rd_p3) begin
            q_data[q_wp] <= sram_rdata;
            q_last[q_wp] <= tag_last3;
            q_err[q_wp]  <= tag_err3 && tag_last3;
        end
    end

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            q_wp  <= {QW{1'b0}};
            q_rp  <= {QW{1'b0}};
            q_cnt <= {(QW+1){1'b0}};
        end else begin
            if (q_push)
                q_wp <= q_wp + 1'b1;
            if (q_pop)
                q_rp <= q_rp + 1'b1;
            case ({q_push, q_pop})
                2'b10:   q_cnt <= q_cnt + 1'b1;
                2'b01:   q_cnt <= q_cnt - 1'b1;
                default: q_cnt <= q_cnt;
            endcase
        end
    end

    assign out_valid = (q_cnt != 0);
    assign out_data  = q_data[q_rp];
    assign out_last  = q_last[q_rp];
    assign out_err   = q_err[q_rp];

endmodule
''')

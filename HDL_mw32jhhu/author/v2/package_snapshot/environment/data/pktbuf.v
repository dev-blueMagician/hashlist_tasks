// pktbuf.v
//
// Packet buffer between the line-side receive stream and the switch
// interface. Packets arrive on a valid/ready stream, are stored in an
// external synchronous SRAM, and leave on a second valid/ready stream.
// The block behaviour is specified in docs/pktbuf_spec.md.
//
// Written for board rev B, where the SRAM is the NW61F1024 flow-through
// part (docs/NW61F1024_excerpt.md).
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

    wire [AW:0]    used       = wr_ptr - rd_ptr;
    wire           can_accept = (used != CAP) && (desc_cnt != ND);

    // One SRAM command per cycle. When ingress and egress both want the
    // SRAM, they take turns.
    assign in_ready = can_accept && !(rd_want && rr_rd);
    assign wr_go    = in_valid && in_ready;
    assign rd_go    = rd_want && !wr_go;

    wire pkt_drop = wr_go && in_last && in_err && !cfg_cut_through;
    wire pkt_push = wr_go && in_last && !pkt_drop;
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

    // Store-and-forward: only words of complete packets.
    // Cut-through: any word already written.
    wire rd_avail   = cfg_cut_through ? (rd_ptr != wr_ptr) : head_valid;

    assign pkt_pop  = rd_go && rd_last;

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
            sram_addr  <= wr_ptr[AW-1:0];
            sram_wdata <= in_data;
        end else if (rd_go) begin
            sram_addr  <= rd_ptr[AW-1:0];
        end
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

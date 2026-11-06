// pktbuf.v
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
    reg  [AW:0]    wr_ptr_d1, wr_ptr_d2;  // wr_ptr two cycles ago
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
    wire rd_avail   = cfg_cut_through ? (rd_ptr != wr_ptr_d2) : (vis_cnt != 0);

    assign pkt_pop  = rd_go && rd_last;

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            wct_d1    <= 1'b0;
            wct_d2    <= 1'b0;
            wr_ptr_d1 <= {(AW+1){1'b0}};
            wr_ptr_d2 <= {(AW+1){1'b0}};
            safe_cnt  <= {(AW+1){1'b0}};
            push_d1   <= 1'b0;
            push_d2   <= 1'b0;
            vis_cnt   <= {(NDW+1){1'b0}};
        end else begin
            wr_ptr_d1 <= wr_ptr;
            wr_ptr_d2 <= wr_ptr_d1;
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

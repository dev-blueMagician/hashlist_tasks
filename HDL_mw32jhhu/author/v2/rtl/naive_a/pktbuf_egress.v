// pktbuf_egress.v
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
    output wire          rd_want,
    output reg  [AW:0]   rd_ptr,

    input  wire [DW-1:0] sram_rdata,

    output wire          out_valid,
    input  wire          out_ready,
    output wire [DW-1:0] out_data,
    output wire          out_last,
    output wire          out_err
);

    localparam QD = 8;      // output queue entries: up to 4 reads in flight
    localparam QW = 3;      // log2(QD)

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
    wire        q_push    = rd_p3;
    wire        q_pop     = out_valid && out_ready;

    // Ask for a read only when its data is sure to find a free entry.
    assign rd_want = rd_avail && ((q_cnt + in_flight) < QD);

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            rd_ptr <= {(AW+1){1'b0}};
            rd_p0  <= 1'b0;
            rd_p1  <= 1'b0;
            rd_p2  <= 1'b0;
            rd_p3  <= 1'b0;
        end else begin
            if (rd_go)
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
        if (q_push) begin
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

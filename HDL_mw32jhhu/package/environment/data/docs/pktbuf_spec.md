# pktbuf: packet buffer, block specification

Revision 1.4. Applies to `pktbuf.v` and `pktbuf_egress.v`.

## 1. Purpose

`pktbuf` sits between the line-side receive stream and the switch interface. It stores whole packets, or forwards them as they arrive, using an external synchronous SRAM as the buffer memory. One SRAM holds the words of all packets in a ring, in arrival order.

## 2. Parameters

| Name | Meaning | Supported |
| --- | --- | --- |
| `DW` | Data width of both streams and of the SRAM word | 8 to 32 |
| `AW` | SRAM address width; the buffer holds 2**`AW` words | 6 to 12 |

The line card uses `DW = 32`, `AW = 10`. Other boards use other values; the block must work for every supported combination.

## 3. Ports

| Port | Dir | Width | Description |
| --- | --- | --- | --- |
| `clk` | in | 1 | Clock. The SRAM is clocked from the same clock. |
| `rst_n` | in | 1 | Reset, active low, asserted asynchronously, released synchronously to `clk`. |
| `cfg_cut_through` | in | 1 | 0: store-and-forward. 1: cut-through. Static, see 5.4. |
| `in_valid` | in | 1 | Ingress beat valid. |
| `in_ready` | out | 1 | Ingress beat accepted at this edge if `in_valid` is also high. |
| `in_data` | in | `DW` | Ingress data. |
| `in_last` | in | 1 | Last beat of a packet. |
| `in_err` | in | 1 | Packet error. Only meaningful with `in_last`; ignored on other beats. |
| `out_valid` | out | 1 | Egress beat valid. |
| `out_ready` | in | 1 | Egress beat taken at this edge if `out_valid` is also high. |
| `out_data` | out | `DW` | Egress data. |
| `out_last` | out | 1 | Last beat of a packet. |
| `out_err` | out | 1 | Packet error, on the last beat only (cut-through mode). |
| `out_retry` | in | 1 | Retry request from the switch. Sampled only at the edge that moves the last beat of a packet; ignored at every other edge. See 5.5. |
| `drop_count` | out | 16 | Packets dropped since reset, wraps at 2**16. |
| `sram_ce_n` | out | 1 | SRAM chip enable, active low. A command is issued in each cycle with `sram_ce_n` low. |
| `sram_we_n` | out | 1 | SRAM write enable, active low: low for a write command, high for a read command. |
| `sram_addr` | out | `AW` | SRAM word address. |
| `sram_wdata` | out | `DW` | SRAM write data (to the SRAM's D inputs). |
| `sram_rdata` | in | `DW` | SRAM read data (from the SRAM's Q outputs). |

All `sram_*` outputs are driven from flops. The ports connect straight to the SRAM pins: the board and the FPGA I/O add no register stages. When the SRAM samples the pins and when it returns read data depend on the SRAM part; see the board's SRAM datasheet.

## 4. Streams

Both streams use valid/ready. A beat moves at a rising edge of `clk` at which valid and ready are both high. Once valid is high, the sender holds the beat (data, last, err) unchanged until it moves. `in_ready` may change at any time; a sender does not wait for `in_ready` before raising `in_valid`.

A packet is 1 or more beats, the last with `in_last` high. In store-and-forward mode a packet is at most 2**`AW` beats. In cut-through mode there is no limit.

## 5. Behaviour

### 5.1 Reset

While `rst_n` is low and after it is released: `out_valid` is low, `drop_count` is 0, and no SRAM command is issued (`sram_ce_n` high) until there is a beat to write. `in_ready` is high no later than 4 cycles after release.

### 5.2 Store-and-forward (`cfg_cut_through` = 0)

A packet is sent on the egress stream only after its last beat has been received. A packet whose last beat has `in_err` high is dropped: none of its beats is sent, and `drop_count` increments by one. Packets leave in the order they arrived. `out_err` is always 0.

### 5.3 Cut-through (`cfg_cut_through` = 1)

A packet may start on the egress stream as soon as its first beat has been stored. No packet is dropped and `drop_count` does not change. `out_err` is high on the last beat of a packet whose last ingress beat had `in_err` high, and low on every other beat.

### 5.4 Changing mode

`cfg_cut_through` may change only while the block is empty (every accepted beat has been sent or dropped) and no ingress beat has been accepted for at least 8 cycles. After a change, no ingress beat is offered for at least 8 cycles.

### 5.5 Retry (store-and-forward)

In store-and-forward mode the switch can refuse a packet at its end. If `out_retry` is high at the edge that moves the last beat of a packet, the block sends the same packet again, complete and unchanged, before any other packet. The resent packet can be refused again in the same way, any number of times. If `out_retry` is low at that edge, the packet is released. In cut-through mode `out_retry` is ignored.

### 5.6 Capacity and flow control

The buffer holds up to 2**`AW` words and up to 8 packets whose last beat has been received but which have not yet been released (store-and-forward) or completely read from the SRAM (cut-through). `in_ready` is low while either limit is reached. In store-and-forward mode a packet's words are kept until the packet is released. A word's location is free again once the block no longer needs it.

### 5.7 SRAM use

The SRAM takes one command per cycle. How the ingress and egress sides share it is up to the design, within the requirements of section 6. (The rev B design lets them take turns.) Once the block is empty (every accepted beat has been sent or dropped) and no beat is being received, it issues no SRAM command.

## 6. Performance

### 6.1 Ingress

While the buffer has room and the egress side is not reading, one beat is accepted per cycle.

### 6.2 Egress

While `out_ready` is high and the SRAM is not needed by the ingress side, one beat per cycle is sent, with no gaps, until the stored words run out.

### 6.3 Line rate

In store-and-forward mode, with the block empty, a packet of up to 32 beats whose beats are all offered back to back is accepted at one beat per cycle. If `out_ready` is held high and nothing else arrives, the first egress beat moves no later than 4 cycles after the edge that took the last ingress beat, and the remaining beats follow at one per cycle with no gaps.

### 6.4 Cut-through first beat

In cut-through mode, when the block is empty (every accepted beat has been sent) and `out_ready` is high, the first beat of a packet moves on the egress stream no later than 5 cycles after the edge that took it at the ingress. This is the switch's arbitration budget for cut-through packets.

## 7. Implementation notes

- The design must be synthesizable RTL. Everything below the top level is in `pktbuf.v` and `pktbuf_egress.v`.
- No initial blocks, delays, system tasks other than `$clog2`, `$signed` and `$unsigned`, and no compiler directives other than `` `timescale `` and `` `default_nettype ``. Parameter overrides on instances are by name.
- Every flop that affects behaviour is reset; the block must behave the same whatever the power-up state of its flops and memories.

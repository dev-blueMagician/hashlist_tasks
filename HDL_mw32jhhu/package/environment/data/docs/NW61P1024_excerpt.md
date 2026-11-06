# NW61P1024: 1K x 32 synchronous SRAM, pipelined, late write, separate I/O

Datasheet excerpt (functional description and timing summary). Rev 1.4.

## Description

The NW61P1024 is a 32 768-bit synchronous static RAM organised as 1024 words of 32 bits, with separate data inputs (D) and data outputs (Q). It is pin-compatible with the NW61F1024. All inputs are registered at the rising edge of CLK. Reads go through an output pipeline whose depth is set by the LAT pin. Writes use late write: the write data follows the write command by one cycle, so reads and writes can be mixed at one command per cycle without dead cycles.

## Pins

| Pin | Type | Description |
| --- | --- | --- |
| CLK | in | Clock. All inputs are sampled at its rising edge. |
| CE# | in | Chip enable, active low. High: no operation (deselect). |
| WE# | in | Write enable, active low. Low with CE# low: write. High with CE# low: read. |
| A[9:0] | in | Word address. |
| D[31:0] | in | Write data, sampled one cycle after the write command (late write). |
| Q[31:0] | out | Read data. Driven at all times; undefined except in the read data cycle. |
| LAT | in | Read latency select, static (strap). See below. Must not change while CLK runs. |

## Read latency

| LAT | Read latency RL (command edge to capture edge) | Clock frequency, max |
| --- | --- | --- |
| L | 2 cycles | 100 MHz |
| H | 3 cycles | 166 MHz |

## Operation

Edge *n* is the rising edge of CLK at which a command is sampled.

| Command at edge *n* | Behaviour |
| --- | --- |
| Deselect (CE# high) | No operation. |
| Read (WE# high) | A is sampled at edge *n* and the word is read from the array at edge *n*. It is on Q in the cycle before edge *n*+RL and is captured by the controller at edge *n*+RL. Q holds it for that one cycle only. |
| Write (WE# low) | A is sampled at edge *n*. D is sampled at edge *n*+1, whatever command is issued at edge *n*+1. |

Any sequence of reads, writes and deselects may be issued, one command per cycle. No dead cycle is needed between a read and a write in either order.

## Timing summary

| Parameter | Symbol | Min | Max | Unit | Notes |
| --- | --- | --- | --- | --- | --- |
| Clock cycle time, LAT = L | tCYC | 10.0 | | ns | |
| Clock cycle time, LAT = H | tCYC | 6.0 | | ns | |
| Write data after write command | tWD | 1 | 1 | cycle | |
| Read latency | RL | 2 / 3 | 2 / 3 | cycle | set by LAT |

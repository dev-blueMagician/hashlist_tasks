# NW61F1024: 1K x 32 synchronous SRAM, flow-through, separate I/O

Datasheet excerpt (functional description and timing summary). Rev 2.1.

## Description

The NW61F1024 is a 32 768-bit synchronous static RAM organised as 1024 words of 32 bits, with separate data inputs (D) and data outputs (Q). All inputs are registered at the rising edge of CLK. Reads are flow-through: the addressed word appears on Q in the same cycle, after the clock edge that sampled the read command.

## Pins

| Pin | Type | Description |
| --- | --- | --- |
| CLK | in | Clock. All inputs are sampled at its rising edge. |
| CE# | in | Chip enable, active low. High: no operation (deselect). |
| WE# | in | Write enable, active low. Low with CE# low: write. High with CE# low: read. |
| A[9:0] | in | Word address. |
| D[31:0] | in | Write data. |
| Q[31:0] | out | Read data. Driven at all times; undefined except in the read data cycle. |

## Operation

Edge *n* is the rising edge of CLK at which CE# is sampled low.

| Command at edge *n* | Behaviour |
| --- | --- |
| Deselect (CE# high) | No operation. |
| Read (WE# high) | A is sampled at edge *n*. The word is on Q after edge *n* and is captured by the controller at edge *n*+1. |
| Write (WE# low) | A and D are sampled at edge *n*. The word is written at edge *n*. |

A read at edge *n*+1 of the address written at edge *n* returns the new data. Any sequence of reads and writes may be issued, one per cycle.

## Timing summary

| Parameter | Min | Max | Unit |
| --- | --- | --- | --- |
| Clock frequency | | 133 | MHz |
| Read latency (command edge to capture edge) | 1 | 1 | cycle |

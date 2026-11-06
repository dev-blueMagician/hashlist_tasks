# txsched: transmit scheduler, rev A

Block specification. Owner: MAC subsystem team. Applies to the RTL in `txsched.v`, `txsched_timebase.v`, `txsched_fifo.v` and `txsched_rr.v`.

## 1. Purpose

txsched sits between the frame descriptor producers of the Ethernet MAC and the MAC transmit engine. Producers queue frame descriptors on one of NCH channels. txsched moves one descriptor per clock cycle, round robin over the channels, into a registered output stage that the MAC reads on a valid/ready interface. A tick counter, `now`, gives the time base, and each descriptor leaves stamped with the time it was taken.

All signals are synchronous to the rising edge of `clk`. There is one clock domain.

## 2. Parameters

| Parameter | Range | Default | Meaning |
| --- | --- | --- | --- |
| `NCH` | 2 to 8 | 4 | Number of channels |
| `DW` | 1 to 32 | 16 | Width of a frame descriptor |
| `DEPTH` | 2 to 16 | 4 | Descriptors each channel queue holds. Need not be a power of two |
| `TS_W` | 8 to 32 | 32 | Width of the tick counter `now` |
| `PRESC` | 1 to 16 | 1 | Clock cycles per tick |
| `LATE_WIN` | 1 to 2^(TS_W−2) | 64 | Reserved for launch-time scheduling (section 8). Unused in rev A |

The design must work at every combination of these values.

## 3. Ports

| Port | Dir | Width | Meaning |
| --- | --- | --- | --- |
| `clk` | in | 1 | Clock |
| `rst_n` | in | 1 | Synchronous reset, active low |
| `in_valid` | in | 1 | A descriptor is offered |
| `in_ready` | out | 1 | The offered descriptor's channel has room |
| `in_ch` | in | 3 | Channel of the offered descriptor |
| `in_data` | in | DW | The descriptor |
| `in_lt_en` | in | 1 | Reserved (section 8). Ignored in rev A |
| `in_lt` | in | TS_W | Reserved (section 8). Ignored in rev A |
| `out_valid` | out | 1 | The output stage holds a descriptor |
| `out_ready` | in | 1 | The MAC accepts the descriptor this cycle |
| `out_ch` | out | 3 | Channel the descriptor came from |
| `out_data` | out | DW | The descriptor |
| `out_gts` | out | TS_W | Grant time stamp: the value of `now` in the cycle the descriptor was taken |
| `pause` | in | 1 | Freeze the time base and stop taking descriptors |
| `ts_set` | in | 1 | Load the tick counter this cycle |
| `ts_set_val` | in | TS_W | Value to load |
| `now` | out | TS_W | Tick counter |
| `late_mask` | out | NCH | Reserved (section 8). 0 in rev A |
| `late_cnt` | out | 16 | Reserved (section 8). 0 in rev A |

`out_ch`, `out_data` and `out_gts` are only meaningful while `out_valid` is high.

## 4. Time base

`now` is a TS_W-bit counter that wraps from 2^TS_W − 1 to 0.

- Reset sets `now` to 0 and restarts the prescaler.
- In a cycle with `ts_set` high, `now` takes `ts_set_val` in the next cycle and the prescaler restarts. This also applies while `pause` is high. Software uses it to step the time base, forward or backward, when it corrects the local clock.
- Otherwise, while `pause` is low, `now` advances by one every PRESC cycles: after reset or a load, `now` first advances at the end of the PRESC-th cycle with `pause` low.
- While `pause` is high (and `ts_set` low), `now` and the prescaler hold.

With PRESC = 1 and `pause` low, `now` advances in every cycle.

## 5. Enqueue

Each channel has a queue of DEPTH descriptors.

- In a cycle with `in_valid` high, `in_ready` tells whether the queue of channel `in_ch` has room, counted at the start of the cycle (a descriptor leaving that queue in the same cycle does not make room until the next one). `in_ready` depends on `in_ch` in the same cycle.
- A descriptor is queued at the end of a cycle in which `in_valid` and `in_ready` are both high. Producers may change or withdraw `in_valid`, `in_ch` and `in_data` in any cycle.
- `in_ch` values of NCH and above are never driven.
- A descriptor queued in cycle c can be taken from cycle c + 1 on.

Descriptors leave a channel in the order they were queued.

## 6. Arbitration and output stage

The output stage holds at most one descriptor and drives `out_valid`, `out_ch`, `out_data` and `out_gts` from registers.

- The stage is free in a cycle if it is empty or its descriptor is accepted in that cycle (`out_valid` and `out_ready` both high).
- At the end of a cycle in which the stage is free and `pause` is low, the stage takes the head descriptor of one channel, if any channel has one. The taken descriptor appears on the outputs in the next cycle; `out_gts` holds the value of `now` in the cycle it was taken.
- If the stage is free and no descriptor is taken (no channel has one, or `pause` is high), the stage is empty in the next cycle.
- While the stage is not free, it holds its descriptor and its outputs do not change.

The channel is chosen round robin: the first channel with a descriptor after the channel taken last, counting upwards and wrapping from NCH − 1 to 0. After reset the channel taken last counts as NCH − 1, so channel 0 comes first.

A descriptor can be taken in the cycle the previous one is accepted, so the stage can deliver one descriptor in every cycle.

## 7. Reset

`rst_n` is sampled at the rising edge of `clk`. In the cycle after reset: all queues are empty, the output stage is empty, `now` is 0 and the round-robin position is as described in section 6. Every flop and memory may power up with any value; the design must not depend on it.

## 8. Reserved for launch-time scheduling

`in_lt_en`, `in_lt`, `LATE_WIN`, `late_mask` and `late_cnt` are reserved for launch-time scheduling, planned for rev B. Rev A ignores the inputs and drives `late_mask` and `late_cnt` to 0.

## 9. Verification

`make -s -C /app/data` runs the smoke test (`tb/tb_smoke.v`) on Icarus Verilog; `make -s -C /app/data verilator` runs it on Verilator with random power-up state. The smoke test covers rev A behaviour at the default parameters.

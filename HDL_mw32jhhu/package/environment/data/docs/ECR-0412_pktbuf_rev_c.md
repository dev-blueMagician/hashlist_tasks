# ECR-0412: pktbuf on board rev C

| | |
| --- | --- |
| Status | Approved |
| Affects | `pktbuf.v`, `pktbuf_egress.v` (line card FPGA) |
| Board | Line card rev C |

## Reason

The buffer SRAM on rev B, NW61F1024, is end of life. Rev C fits the NW61P1024 in its place. The footprint and the signals between FPGA and SRAM are the same: CE#, WE#, A[9:0], D[31:0] (write data) and Q[31:0] (read data). The NW61P1024 is a pipelined part with late write, so its timing differs. See `NW61F1024_excerpt.md`, `NW61P1024_excerpt.md` and `board_rev_c_notes.md`.

## Change

1. `pktbuf` works with the NW61P1024 as fitted and strapped on rev C boards. Rev B support is not needed. The other boards that use `pktbuf` with other `DW`/`AW` move to NW61P-family parts of the matching organisation, wired and strapped as on rev C, so the same SRAM timing applies at every `DW`/`AW`.
2. The top-level module name, ports and parameters stay as they are. The FPGA top level is not changed.
3. Behaviour stays as in `pktbuf_spec.md` for every supported `DW` and `AW`, in both modes, under any backpressure, with one exception: the line-rate limit in section 6.3 becomes **10 cycles** from the edge that took the last ingress beat to the edge that takes the first egress beat (was 4). Everything else in section 6 is unchanged: the ingress rate in 6.1, the gap-free requirements in 6.2 and 6.3, and the cut-through first-beat latency in 6.4, which is fixed by the switch.
4. All logic stays in `pktbuf.v` and `pktbuf_egress.v`.

## Verification

The block regression is being moved to a rev C SRAM model and will be run on the changed RTL at several `DW`/`AW` settings, on Icarus Verilog and on Verilator with random power-up state. The smoke test in `tb/` models the rev B part and is not part of the sign-off.

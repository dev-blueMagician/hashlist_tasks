The line card's packet buffer, `pktbuf`, has to move to board rev C. Rev C replaces the buffer SRAM, NW61F1024, with the NW61P1024 on the same footprint and pins. ECR-0412 is approved: make the RTL change so that `pktbuf` works on rev C boards as they are built.

Everything is in `/app/data`:

- `pktbuf.v`, `pktbuf_egress.v`: the design as it runs on rev B today.
- `docs/pktbuf_spec.md`: the block specification.
- `docs/ECR-0412_pktbuf_rev_c.md`: the change request.
- `docs/NW61F1024_excerpt.md`, `docs/NW61P1024_excerpt.md`: the old and the new SRAM.
- `docs/board_rev_c_notes.md`: rev C board notes.
- `tb/tb_smoke.v` and `Makefile`: a smoke test with a model of the rev B SRAM. `make -s -C /app/data` runs it on Icarus Verilog, `make -s -C /app/data verilator` on Verilator. It passes on the design as handed over. It is not graded and you may change it.

What is graded is `/app/data/pktbuf.v` and `/app/data/pktbuf_egress.v` as you leave them. Only these two files are compiled, so every module the design uses must be in them. Keep the top module `pktbuf` with its name, ports and parameters unchanged; the modules under it are yours to change.

The grader runs withheld testbenches against a model of the rev C SRAM, with random traffic and backpressure, at several `DW`/`AW` settings. It checks the behaviour and performance in the specification as amended by the ECR. Each testbench runs once on Icarus Verilog 13 (`iverilog -g2012`) and 16 times on Verilator 5.048 (`--binary --timing --x-initial unique --x-assign unique`, `+verilator+rand+reset+2`), each time with a new stimulus seed and new random power-up values for every flop and memory. A check passes only if it passes in every run.

Before any testbench runs, the two files must pass these rules, or the score is 0:

- synthesizable RTL that elaborates on its own at every graded `DW`/`AW`;
- no `initial` blocks, delays, `force`/`release`, `defparam`, `bind`, `import`/`export`, `wait`, `fork`, `forever`, `while`, `event` or `->`, escaped identifiers, hierarchical names or user-defined primitives;
- no system tasks or functions except `$clog2`, `$signed` and `$unsigned`, and no compiler directives except `` `timescale `` and `` `default_nettype ``;
- every event control is `@*` or a list of `posedge`/`negedge` edges, and opens an `always` block;
- no register given a value where it is declared;
- parameter overrides on instances by name only, as in `#(.DW(DW))`.

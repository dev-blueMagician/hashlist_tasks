# Task notes: HDL_mw3wykhl_Yeal

Builder id `task-mw3wykh1`: the page shows the digit **1** at the end, while the folder name has the letter **l** (`mw3wykhl`). Plans must use `task-mw3wykh1`. The folder keeps its name, because Claude Code files sessions under the path; it also doesn't follow the kit's naming rule. Builder uuid: not yet seen (the saved HTML has no address; round 1's log will name it). Brief "HDL feature development (Verilog)", $450 per successful submission, "Several submissions allowed", "Optimised run 5-6h", shell "Tasks open on RTL · terminal". Section 4 title: not set.

## Task and current state

- Third take of this brief. `author/brief.txt` (from `author/Hashlist Data Operations Platform.html`, sha256 `e8bb9f08…1f4f`) matches `HDL_mw3o014d_Trung/author/brief.txt` line for line, apart from the task id (checked 2026-11-05). Brief summary:
  - The model changes a working Verilog block the way an RTL engineer would: add a feature, port it to a new memory or bus, or add a mode. A withheld testbench grades it.
  - Rejected: plain feature-adds that strong models solve from the prompt alone, pure bug fixes, copied public PRs without a changed spec.
  - Wanted: "a fact the model has to work out rather than read off": a latency only a characterization report reveals, a buried datasheet corner, an interaction between the new feature and an existing mode.
  - Acceptance: "the grader check on your task must say SOUND, and the frontier models should pass it sometimes but not always." 1.1 shows ten runs of one task with spread scores and says "Strong models should score higher than weak ones, and the correct answer higher than any common mistake."
- Deliverable (brief): base RTL 150–1500 lines (own, or open core under Apache-2.0, Solderpad, BSD or MIT with NOTICE); change request with the full interface and timing contract; smoke testbench (`make -s -C /app/data`) that passes on the base and says nothing about the new behaviour; hidden testbench with a reference model, random traffic from `+seed`, at least two parameter sets, printing `CHECK <nonce> <name> PASS|FAIL` and `DONE <nonce>`; `verifier/rtl.json` with `must` = checks the base already passes; references gold (1.00), naive_base (0.00), and at least two wrong changes (plausible partial feature, most likely shortcut), each below gold.
- What the model hands in: the design files under `/app/data`. Top module name and ports fixed; the modules under it are the model's.
- Platform state: draft. Only 1.1 seen, "Saved".
- Run side effects: Run submits for review (kit, 1.3). No authorisation to Run.
- AI assistance: the user stated it is allowed (CLAUDE.md). Re-check the 5.1 page; the user rewrites step texts (memory).
- Design: not started. Constraint from `HDL_mw32jhhu` (`_kit/LESSONS.md`): 12 of 12 blind Opus and Sonnet solvers scored 1.00 across three versions with complete documents. Its v3 run results are still pending; read them before settling a design. `HDL_mw3o014d_Trung` is designing in parallel; keep the two designs different.

## Environment and submission contract

Expected to match `HDL_mw32jhhu` (same template script `templates-BGWu7Xpg.js` as of 2026-11-05). Details and grader rules: `HDL_mw32jhhu/TASK-NOTES.md` and `HDL_mw32jhhu/author/platform/report.py.from-bundle`. Not yet confirmed for this task's own saved settings.

| Item | Model environment | Grader environment | Evidence |
| --- | --- | --- | --- |
| Target and toolchain | Template `debian:forky-20261005-slim` + `iverilog verilator g++ make python3`; seen elsewhere as Icarus 13.0, Verilator 5.048 | Same, plus `verifier/` → `/tests` | round 1 probe (not run) |
| Grader route | not applicable | lint of `dut` files; design-alone elaboration per `params`; each bench once on Icarus and 16× on Verilator; 300 s per run; reward 0 if lint, elaboration or a `must` check fails | report.py from the bundle |
| Limits | Template 4 CPU, 8 GiB, 8 GiB disk, 300 steps (not an option: set 500), 60 min | grader timeout 15 min | not yet seen here |

- Known traps (kit): don't name a module `design`; 5.2's answer list defaults to `/app/data/design.v`, so set it to the `dut` files; 5.3 has no `naive_base` slot (upload it as one more mistake); remove the template's `verifier/rtl.json` before uploading ours; `$random(seed)` differs between Icarus and Verilator.

## Verification evidence

| Check | Revision and command or action | Result and evidence |
| --- | --- | --- |
| Box tool versions | Plan round 1, `author/probes/probe-1-toolchain.txt` (same probe that passed in `HDL_mw32jhhu`) | not run |
| Starter baseline | — | not run (no design yet) |
| Solution from the public starter through the grading route | — | not run |
| Gold and mistakes | — | not run |
| Saved platform files match the tested revision | — | not run |

## Outstanding issues

- Next action: plan round 1 (`author/builder-plan.json`, output in `author/round1/`). It saves every screen as text and HTML, the five 1.2 panels, sets the step limit to 500, and runs the toolchain probe in Try the box. Then read every page, record the settings here, and agree a design with the user.

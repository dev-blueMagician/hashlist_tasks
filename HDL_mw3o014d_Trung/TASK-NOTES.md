# Task notes: HDL_mw3o014d_Trung

Builder id `task-mw3o014d`, builder uuid `cd7e12b1-46a7-43c7-8ef7-80de157473d8` (round 1 plan log). Brief "HDL feature development (Verilog)", $450 per successful submission, "Several submissions allowed", "Optimised run 5-6h", shell "Tasks open on RTL · terminal". Section 4 title: not set. The folder name doesn't follow the kit's naming rule; it stays, because Claude Code files sessions under the path.

## Task and current state

- Same brief as `HDL_mw32jhhu` (second take). The brief text in `author/brief.txt` matches `HDL_mw32jhhu/author/brief.txt` line for line, apart from blank lines (2026-11-05). Brief summary:
  - The model changes a working Verilog block the way an RTL engineer would: add a feature, port it to a new memory or bus, or add a mode. A withheld testbench grades it.
  - The brief rejects plain feature-adds, pure bug fixes, and copied public PRs without a changed spec.
  - It wants "a fact the model has to work out rather than read off": a latency only a characterization report reveals, a buried datasheet corner, or an interaction between the new feature and an existing mode.
  - Acceptance rule: "the grader check on your task must say SOUND, and the frontier models should pass it sometimes but not always".
- Deliverable (brief):
  - base RTL, 150–1500 lines, own or open core (Apache-2.0, Solderpad, BSD or MIT, licence in NOTICE);
  - the change request with the full interface and timing contract;
  - a smoke testbench that passes on the base and says nothing about the new behaviour (`make -s -C /app/data`);
  - a hidden testbench with a reference model, random traffic from `+seed`, at least two parameter sets, printing `CHECK <nonce> <name> PASS|FAIL` and `DONE <nonce>`;
  - `verifier/rtl.json` with `must` = checks the base already passes;
  - references gold (1.00), naive_base (0.00), and at least two wrong changes (a plausible partial feature and the most likely shortcut), each below gold.
- What the model hands in: the design files under `/app/data`, as it leaves them. Top module name and ports fixed; modules under it are the model's to change.
- Platform state: draft. Only 1.1 seen (`author/Hashlist Data Operations Platform.html`, sha256 `b0b71eed…e968`; text in `author/brief.txt`), showing "Saved".
- Run side effects: Run submits for review (kit, 1.3). No authorisation to Run.
- AI assistance: the user stated it is allowed (CLAUDE.md). Re-check the 5.1 page, which said "No AI-generated steps" on earlier tasks; the user rewrites step texts (memory).
- Design A (chosen by the user 2026-11-06): `txsched`, my own transmit scheduler (rev A, 315 lines in four files). ECR-0731 adds launch-time scheduling. Facts to work out (each stated as a rule, none given as a formula):
  - every comparison is modular on the wrapping counter (ECR section 5); the smoke test's `TS_W = 32` never wraps, and the hidden bench runs `TS_W = 8` and `10` and sets the counter near the wrap at 32;
  - the output stage is registered, so "may appear only when `now` is at or after T" means deciding against the next cycle's `now`, which `ts_set`, `pause` and the prescaler all change;
  - earliest-first ordering across the wrap, best-effort below scheduled, ties in round-robin order;
  - drops whether or not the stage is free, not while paused, and after time steps.
  The constraint carried from `HDL_mw32jhhu` (`_kit/LESSONS.md`) still holds: 12 of 12 blind Opus and Sonnet solvers scored 1.00 there across three versions, with complete documents. So blind-test first.
- Author files: `author/rtl/{base,gold,naive_a..e}/`, variants from `author/tools/make_variants.py`; bench `author/bench/tb_txsched.v` + `rtl.json` (10 checks, `must` = reset_idle, best_effort; params {4,16,4,32,1,64}, {3,8,3,8,3,20}, {8,12,2,10,1,100}); docs in `author/docs/`; smoke bench in `author/data/`. `author/tools/grade_local.sh <dir> <label>` runs the platform's `report.py` (copied to `author/platform/report.py.from-bundle`, sha256 `b12b83bc…78a1`) through MSYS2's `/usr/bin/python3`. `author/tools/run_icarus.sh` and `run_vl.sh` are quick single runs.
- Package `package/`: `agent/PROMPT.md`, `environment/data/` (four rev A files, `Makefile`, `tb/tb_smoke.v`, `docs/txsched_spec.md`, `docs/ECR-0731_launch_time.md`, `NOTICE`). Hashes in `author/probes/local-sha256-blind1.txt`.

## Environment and submission contract

Expected to be the same as `HDL_mw32jhhu`. The template script the builder loads, `templates-BGWu7Xpg.js`, has the same sha256 (`15a875ea…d0ed`) as the copy saved there, so the generated `report.py`, Dockerfile and default `rtl.json` are unchanged (inference: this task's saved settings could still differ; check 2.1–2.4). Copies of the builder's current scripts, fetched 2026-11-05, are in `author/platform/`.

| Item | Model environment | Grader environment | Evidence |
| --- | --- | --- | --- |
| Target and toolchain | Template: `debian:forky-20261005-slim` + `iverilog verilator g++ make python3`; seen in HDL_mw32jhhu's box as Icarus 13.0, Verilator 5.048, g++ 16.2.0, make 4.4.1, Python 3.14.7 | Same base and packages, plus `verifier/` → `/tests` | template hash; this task's box not yet probed |
| Commands | bash, `view_image`, `submit(notes)`; smoke `make -s -C /app/data` | generated `report.py` (don't edit) | brief; `HDL_mw32jhhu/TASK-NOTES.md` |
| Grader route | not applicable | lint of the `dut` files; elaboration of the design alone per `params` set; each bench once on Icarus and 16× on Verilator (`--x-initial unique`, `+verilator+rand+reset+2`), `+nonce`, `+seed`; 300 s per run; reward 0 if lint, elaboration or a `must` check fails, otherwise the share of paying checks passed | `HDL_mw32jhhu/author/platform/report.py.from-bundle` |
| Limits | Template: 4 CPU, 8 GiB, 8 GiB disk, 300 steps (not an option in 2.2: set it), working time 3600 s | grader timeout 900 s | template; not yet seen on this task's 2.2 |

- Public layout: `environment/data/` → `/app/data/`. Answer list in 5.2 defaults to `/app/data/design.v`; set it to the `dut` files.
- Withheld: `references/*.py`, `verifier/rtl.json`, hidden benches.
- Known traps (kit): don't name a module `design`; 5.3 has no `naive_base` slot (upload it as one more mistake); remove the template's default `verifier/rtl.json` before uploading ours; `$random(seed)` differs between Icarus and Verilator, so benches compute expectations from the stimulus they generated.
- Author's PC: `py` is Python 3.14; MSYS2 UCRT64 has Icarus 13.0 and Verilator 5.050 (see `HDL_mw32jhhu/TASK-NOTES.md` for the run line and the local `OPT_FAST` link fix).

## Verification evidence

| Check | Revision and command or action | Result and evidence |
| --- | --- | --- |
| Box tool versions | Plan round 1, `author/probes/probe-1-toolchain.txt` | not run |
| Plan round 1 | extension 2.1, `author/round1/plan-log-20261106-100841.txt` | save_all saved 16 pages but each showed the previous screen (body renders after the step bar); the 2.4 fill found no box and the plan stopped. uuid `cd7e12b1-46a7-43c7-8ef7-80de157473d8`. Fixed in the extension |
| Plan round 2 | `vm/round2.zip` (extension 2.2 inside), `author/round2/plan-log-20261106-120534.txt` | The VM ran an older copy: no `body:` line, captures one screen behind, the select and the 2.4 fill found nothing. Still visible: 2.2 = 4 cores, 8 GiB, 8 GiB disk, grader 15 minutes, step limit blank ("Step limit model turns"), working time 60 minutes; 2.4 = template image `debian:forky-20261005-slim@sha256:3c80e257…13e3`, packages `iverilog verilator g++ make python3`, "Template box, already checked", Language select "Python", and the command box holds "null". Extension now 2.3 and logs its version; round 3 is `vm/round3.zip` |
| Plan round 3 | `vm/round3.zip`, `author/round3/plan-log-20261106-122304.txt` (`extension: 2.3`) | Same failure. The runner was 2.3, but the builder tab still ran the `page.js` injected in round 1 (no `body:` line): the runner injected only when no `dopHelper` existed, and the builder never reloads. Fixed in 2.4 (fresh inject per runner window, version check). Round 4 is `vm/round4.zip`, with an F5 of the builder tab |
| Starter baseline | smoke on copies of `package/environment/data`, Icarus 13.0 and Verilator 5.050 local | base and gold: SMOKE PASS on both simulators |
| Bench on gold and base, Icarus, 3 parameter sets, seed 11 | `author/tools/run_icarus.sh` | gold all 10 PASS; base passes reset_idle and best_effort, fails all 8 paying checks |
| Variants, Icarus, 3 parameter sets | same | naive_a (no wrap) and naive_b (current `now`) fail all 8 paying checks; naive_c (raw earliest-first) 2–7 by set; naive_d (drop only when stage free) 7; naive_e (no class priority) 7–8. Checks barely separate: the bench compares every output in every cycle |
| report.py, after the class-phase fix | `grade_local.sh`, `author/grade-2320.txt` | gold 1.00; naive_a 0.00, naive_b 0.00, naive_c 0.00, naive_d 0.125, naive_e 0.00, base 0.00 |
| Blind solvers, round 1 (`author/blind1/`) | subagents given only a copy of `package/environment/data` and the prompt; graded with `grade_local.sh` | s2 (Opus) 1.00 in 6.5 min; s3 (Sonnet) 1.00 in ~4 min; s4 (Sonnet) 1.00 in 3 min; s1 (Opus) 1.00 in 13.5 min (4 of 4). All three derived the next-cycle `now`, modular lag, largest-lag-first and the drop rules from the ECR text, and checked them with their own cycle models. Design A as written is too easy |
| First report.py run | `grade_local.sh`, before the class-phase fix | naive_base 0.00 (all 8 fail); gold 0.875, failing only on the bench's own guard ("too few class decisions", one power-up seed); fixed by a closer launch window in that phase (class decisions ~87 → ~1200) |
| Solution from the public starter through the grading route | — | not run |
| Gold and mistakes | — | not run |
| Saved platform files match the tested revision | — | not run |

## Outstanding issues

- Unknown: the 2.2–2.4 values as saved (round 1 captures lagged); how `HDL_mw32jhhu` scores. Its v3 was run on 2026-11-05 (user), with no results yet.
- Decision (user, 2026-11-06): option 1. Wait for `HDL_mw32jhhu`'s run results before reworking design A (4 of 4 blind solvers at 1.00), and finish the builder setup that does not depend on the design meanwhile. Options on the table afterwards: 2, rework the ECR so the interactions with pause, time steps and the registered output follow from the rev A spec instead of being restated; 3, a larger base with a stateful existing mode such as a credit-based shaper.
- Next action:
  - the user runs plan round 2 (`author/builder-plan.json`, extension 2.2): step limit 500, the Try-the-box toolchain probe, and save_all into `author/round2/`;
  - then I check those pages and record the 2.1–2.4 settings;
  - when the `HDL_mw32jhhu` results page arrives, save it into `HDL_mw32jhhu/author/` and read the per-model scores and transcripts;
  - nothing in sections 3 to 6 is uploaded until the design is settled.

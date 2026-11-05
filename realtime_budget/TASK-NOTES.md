# Task notes

Authoring notes only; keep outside the solver upload.

## Task and current state

- Required behavior and the work the solver must do: ECP-300 coolant pump controller (STM32F405, FreeRTOS) resets in the field since software 3.2.0 (TMON budget overruns and IWDG resets). The solver re-derives the timing configuration `os_cfg.c` (TMON budgets, priorities, IWDG prescaler/reload) so it meets SRS-ECP300, using TAG-01, the traces, sources, VN-07 and the STM32 documents.
- Allowed changes and deliverable: only `os_cfg.c` values; answer `/app/solution.c` (setup copies the 3.2.0 file there). Periods/deadlines fixed.
- Task identifier and current package or revision: DOP builder `task-mvr6ixva`, builder URL `https://dop.hashlist.com/app/build/aa703c22-37b5-4f2f-a2fd-58b91e767638/…`. Local package `package/`, first revision (harness d72ae0ab…, gold 8ec205a0…). Sections 3 and 4 uploaded; verifier, gold, near misses and scored steps not yet.
- Platform state and save confirmation (saved pages, newest 2026-11-05): Draft. Sections 1, 2.1, 2.3, 2.4, 3, 4 and 5.1 saved (C harness with budgets; internet off; packages `python3, python3-pandas, poppler-utils`, probe 2 passed). 2.2 confirmed 2026-11-05 (`author/2.2-limits-20261105-005535.txt`): 1 core, 2 GiB, 4 GiB, 15 minutes, 100 steps, 30 minutes. 5.2 has the answer path but `references/gold.c` is empty (page of 2026-10-31). 5.3, 5.4, 6, 7 not done.
- Run side effects and existing authorization: 1.3 says "Pressing Run also hands the task in for review." No authorization to Run.

## Brief (author/brief.html, read 2026-10-30)

"Real-Time Budget Planner", $300 per accepted task, "Optimised run", several submissions allowed.

- Environment around a real-time system the author has worked on (ECU, controller, flight or motor control unit): task set and source, MCU manuals and datasheets, RTOS configuration, linker map, measured timing traces, deadlines. Tools: cross-compiler, QEMU or ISS, trace tools, Python, PDF tools, optional schedulability tool.
- Each task: a timing or memory decision or failure; the model writes `answer.json` (WCET bounds, core/priority assignment or memory layout).
- Marking script: bounds against measured traces within a tolerance; response-time analysis of the proposed layout against every deadline and memory limit; score by closeness.
- Hide the deciding load (ISR/DMA bursts, interference, a clock setting in the manual).
- Gold 1.0; naive ("a competent engineer might give first") below 0.3. Frontier models run 10 times: training set if solved in 1–4 runs, evaluation set if failed all 10.
- No rule on AI assistance in the brief.

## Environment and submission contract

C harness with budgets shell (bundle id `constraintbench`; `author/2.1-shell-20261030-141432.txt`, public bundles `templates-Bzqg75dh.js`, `gencheck-Coe4jWZh.js`, `SectionFiles-BEjn3H8K.js`, read 2026-10-30):

| Item | Model environment | Grader environment | Evidence |
| --- | --- | --- | --- |
| Target, OS or RTOS, and toolchain | `gcc@sha256:fa11eac6…` = Debian 12, gcc 13.4.0 | python:3.12-slim-bookworm + Debian gcc 12.2.0-14+deb12u1, binutils 2.40, libc6-dev 2.36 (snapshot 20261006) + pytest 9.1.1 | probe 1 (`author/2.4-toolchain-20261030-155158.txt`) |
| Required commands and installed dependencies | probe 2 with packages `python3, python3-pandas, poppler-utils`: Python 3.11.2, pandas 1.5.3, numpy 1.24.2, pdftotext 22.12.0, make, objdump, file; no gdb. All 10 commands passed | gcc, Python 3.12, pytest | probe 2 (`author/2.4-toolchain-20261030-161820.txt`) |
| Working directory and visible files | `/app`; text uploads under `/app/data/<relative path>`, PDFs and >2 MB in `/app/files/` | `/tests` = `verifier/`; `/app/solution.c` | SectionFiles bundle |
| Startup, linker, libraries, and generated inputs | `os_cfg.h` in `/app/data/src` | `verifier/os_cfg.h` (same sha256 5b767c48…) | local hash |
| Compile and link command | prompt: `gcc -O2 -std=c11 -I/app/data/src -c /app/solution.c` | `gcc -O2 -std=c11 -I/tests -o /tmp/prog /tests/harness.c /app/solution.c -lm`, 180 s | gencheck bundle |
| Run, simulate, or flash command | not applicable (configuration answer) | `/tmp/prog`, 300 s; stdout `metric=value`, first value per label wins | gencheck bundle |
| Transport and synchronization | not applicable | not applicable | |
| Time, memory, network, and other limits | 2.2 saved: 1 core, 2 GiB, 4 GiB disk, 100 steps, grader timeout 15 minutes, working time 30 min (fixed) | | `author/2.2-limits-20261105-005535.txt` |

- Locked files and editable files: `/app/data`, `/app/files` read-only to the model (inference from the last task); `/app/solution.c` created by `hooks/setup.sh`.
- What the grader collects and compiles: `/app/solution.c` with `/tests/harness.c` and `/tests/os_cfg.h`.
- Brief/environment discrepancies: brief's `answer.json` becomes `/app/solution.c` (the configuration file itself). The platform guide says a JSON answer cannot hold reasoning anyway.
- Model gcc 13.4.0 vs grader gcc 12.2: harmless for a data-only file.
- Tampering: solution.c is linked into the harness process. The harness rejects `main`, `__attribute__`, `asm`, `_Pragma`, `#pragma` outside comments and strings (prints `config_ok=0` and failing values). Residual risk: a reserved-priority constructor could print forged lines first, but the labels are hidden.

## Task design

Files: `package/environment/data/{src,docs,traces,field,tools}`, PDFs in `package/environment/files/`, `package/hooks/setup.sh`, `package/agent/PROMPT.md`, `package/references/{gold,naive_a,naive_b,naive_c}.c`, `package/references/steps.md`, `package/verifier/{harness.c,os_cfg.h}`. Generator and checks: `author/gen/generate.py` (simulator, writes the traces and `author/gen/truth.json`), `author/gen/score.py` (Python copy of harness.c), `author/scored-steps.json` (draft 5.4).

Hidden loads:

1. `CAN1_RX0_IRQHandler` (new `can_if_glue.c`) has no TMON brackets, so its time is charged to the running job; TAG-01 appendix A (3.1) says bracketed. The traces show TMON > net time during CAN traffic.
2. Worst CAN rate: bank 1 filter 0x7DF/mask 0x700 accepts 0x700–0x7FF; VN-07 4.5 allows back-to-back diagnostic frames; shortest 8-byte frame 111 bits = 222 µs. The workshop trace has STmin ≈ 1 ms (min gap seen 236 µs, only next to 0x18A).
3. IWDG over the LSI range 17–47 kHz (datasheet; TAG appendix B used 32 kHz). Reset log `lsi_hz` shows IWDG resets on 44.9–46.2 kHz units.

Truth (µs): C = 150, 380, 780, 240, 3900; FOC 9.0/50 bracketed, CAN 52.0/222 charged, SysTick 3.0/1000 charged. M = 257, 539, 1150, 347, 5533. Budget band [M, 1.25 M]. RTA per TAG §4 with budgets and bracketed ISRs only. K = 20 ms + R_sup. IWDG ticks: 47 kHz timeout > K, 17 kHz timeout ≤ 80 ms. With budgets at 1.0–1.25 M the window is (1116..1254, 1360] ticks.

Draft scored steps (worth): five budget ratios [1, 1.25] (3 each), deadlines_met = 5 (1), wdg_margin_us ≥ 1 (2), wdg_max_timeout_ms ≤ 80 (1). Total 19.

| Answer | Mistake | Python-mirror reward |
| --- | --- | --- |
| starter os_cfg.c | 3.1 values | 0.105 |
| gold.c | budgets ceil(1.10 M), PR 0 RL 319 (1280 ticks) | 1.000 |
| naive_a.c | budgets = 1.15 × largest TMON seen in the traces | 0.211 |
| naive_b.c | right budgets, IWDG at nominal 32 kHz (980 ticks) | 0.895 |
| naive_c.c | stale appendix A (CAN bracketed), B = 1.25 M_stale | 0.211 |

Sensitivity: taking CAN T = 270 µs (135 bits) fails SpeedCtrl even with 10 % margin (one CAN hit instead of two); T = 236 µs (min gap seen) passes with 10 % margin.

## Verification evidence

| Check | Revision and command or action | Result and evidence |
| --- | --- | --- |
| Starter baseline and expected missing or incorrect behavior | Python mirror `author/gen/score.py` on `src/os_cfg.c` | 0.105: all budget steps and wdg margin fail. C harness not yet run |
| Exact public starter plus allowed solution passes the actual grading route | not run | |
| Gold meets the expected criteria | Probe 1 in Try the box (gcc 13.4, `author/2.4-toolchain-20261030-174552.txt`), harness d2b65061… | C output equals the Python mirror for starter, gold, naive_a/b/c; a gold copy with "main" in a comment passes; `evil.c` (constructor attribute) gives config_ok=0. Prompt compile command works. Only warning: unused WDG_LIMIT_MS, since removed (harness now d72ae0ab…, not re-run) |
| Required near misses fail the intended criteria | Python mirror + probe 1 | naive_a 0.211, naive_b 0.895, naive_c 0.211 |
| Boundary and repeated-operation checks relevant to this task | Python mirror | budget factor 1.0–1.25 and CAN-T variants checked (above) |
| Saved platform files and generated checks match the tested revision | Probe 2 in Try the box after the 3.1 uploads (`author/2.4-toolchain-20261030-181707.txt`, page `author/3.1-files-20261030-181205.txt`) | All 23 `/app/data` files and both PDFs match `author/probes/local-data-hashes.txt`. Setup hook ran (`/app/solution.c` = starter, root 644 in Try the box). Prompt compile ok, tracestat ok, pdftotext reads the datasheet. Verifier files and steps not uploaded yet |
| Traces | `generate.py` + `tools/tracestat.py` locally | net and ISR maxima equal the design values; no TMON value above the 3.2.0 budgets; sizes 0.94, 0.94, 1.56 MB |

## Outstanding issues

- Inferences not yet confirmed: section 3 layout; hooks box behaviour for this shell.
- Authorship rule: the 5.1 page says "No AI-generated steps." (`author/5.1-your-steps-20261105-005716.txt`; not on this task's 2026-10-31 capture). Its scope is not stated. User decision 2026-11-05: Claude drafts step texts as well as it can, and the user rewrites them in their own words before saving. Compare the saved page with the facts afterwards.
- PDFs (user download, `package/environment/files/`): `DS_stm32f405rg.pdf` (206 pages, sha256 1f41b4fa…) Table 35 p.105: fLSI 17/32/47 kHz at TA -40..105 °C; RM0090 Rev 22 (1741 pages, f3ff2322…) Table 107 footnote: timings at 32 kHz, LSI varies, see datasheet. FM1R 0 = mask mode; TIM5_OR TI4_RMP = 01 routes LSI to TIM5 CH4. SRS temperature corrected to -40..+105 °C to match the device.
- Section 3.1 (`author/3.1-files-20261030-174726.txt`): the "Use one of my environments" panel showed a "Replace and copy" prompt for the EK-LM3S6965 environment; must be cancelled. Box empty, hooks empty.
- Local data hashes: `author/probes/local-data-hashes.txt`; post-upload check: `author/probes/probe-2-commands.txt`.
- Section 3.1 done 2026-10-30 18:12: 5 folders + 2 PDFs uploaded, setup hook pasted, teardown empty; Dockerfile gained `COPY environment/data /app/data`.
- Section 4 saved 2026-10-31 (`author/4.1-task-title-20261031-181257.txt`): title "ECP-300 coolant pump resets after software 3.2.0"; CONTEXT.md empty; PROMPT.md identical to `package/agent/PROMPT.md` (no canary lines were offered).
- 5.1 saved 2026-10-31 19:50 (`author/5.1-your-steps-20261031-195027.txt`): user's own 6-line rewrite (old steps 5 and 6 merged). Fixes suggested for lines 4 and 6; copy the final saved text into `package/references/steps.md`.
- 5.2 (`author/5.2-correct-answer-20261031-195041.txt`): answer path `/app/solution.c` saved, but `references/gold.c` empty.
- `author/hashlist-data-operations-platform-20261102-200609.txt` belongs to `driver_peripheral`, not this task: the reviewer sent that task back as too easy for Opus (recorded in its notes). Before Run here, check this task against that verdict: symptoms must not map one-to-one to checks, and "A task is accepted only when the strongest model fails most of at least 6 runs". This brief's own rule differs (solved in 1–4 of 10 runs, or failed all 10), so confirm which applies.
- Claude sessions from before the 2026-11-01 Windows reinstall are not on this machine; this file is the record of that work. Task files unchanged since 2026-10-31 apart from the page above.
- State re-checked 2026-11-05 after the session loss, locally only: all 23 data files match `author/probes/local-data-hashes.txt`; `PROMPT.md` equals the saved 4.3 text; `verifier/os_cfg.h` equals the public copy; `score.py` reproduces the table above. No local gcc, so harness d72ae0ab… has still never been compiled; Verify will be its first run.
- Open grading gap (measured with `score.py`, 2026-11-05): `tools/tracestat.py` prints "min gap seen" 236.3 us for CAN1_RX0. Using that as T_k, skipping VN-07, gives M = 257, 539, 1098, 347, 5377 and scores reward 1.000 at both 10 % margin (budgets 283, 593, 1208, 382, 5915) and 20 % (309, 647, 1318, 417, 6453). T_k = 229 us (100 ms / 437 frames, the log's busiest value) with 10 % also scores 1.000. So hidden load 2 is not enforced against the trace's own number, although TAG-01 2.3 says traces do not give T_k. Of the T values tried (222, 229, 236.3, 270, 1000 us), only 270 and 1000 lose points.
- Difficulty risk, untested: TAG-01 writes out every formula, the SRS points at VN-07 and component tolerance, and the log's `can_rx_frames_last_100ms` and `lsi_hz` columns point straight at two hidden loads, which resembles the reviewer's complaint on `driver_peripheral`. No model has attempted this task.
- 5.1 saved text, line 4 still says to find the worst-case CAN rate "based on the actual traffic in the system", the opposite of the rest of that line and of TAG-01 2.3. Other claims checked against the log: all five tasks have overruns (16 rows, 12 TMON, 4 IWDG), 290–437 CAN frames in every row, IWDG units all at 45.6–46.2 kHz. Line 6 reads badly and does not say the response time uses the new budgets. WCET values in line 2 confirmed with `tracestat.py` on all three traces. Page of 2026-11-05 holds the same text as 2026-10-31. `references/steps.md` locally is the older 7-line draft; replace it with the user's final saved text, copied verbatim.
- Reset log, 2026-11-05: a crashed edit script emptied the local file; restored from the builder page `author/3.1-files-20261105-100253.txt`, hash matched 2852ec95…, original kept in `author/probes/reset_log_3.2.0.original.csv`. Then `can_rx_frames_last_100ms` × 0.85, rounded, only that column: 315, 292, 331, 308, 265, 280, 357, 345, 320, 299, 336, 364, 341, 246, 371, 341; busiest gap 269.5 us. New local sha256 0081fb41…. The builder still holds the old log and old service trace until re-upload.
- Shortcut fix, local only, 2026-11-05 (user approved closing the gap and a blind test): `generate.py` `serialize()` keeps receptions at least 0.6 ms apart. Regenerated: both bench traces byte-identical, `service_bay_ecm_reflash.csv` changed, `min gap seen` now 599.4 us. Net and ISR maxima unchanged; TMON NvM max 4113.6 (was 4113.2); `score.py` still 0.105, 1.000, 0.211, 0.895, 0.211. Scan: every T up to about 246 us reaches 15/15 budget points with a margin of 5 % or more; from about 250 us SpeedCtrl fails at every margin (best 12/15, until T = 400–500 at exactly 25 %); T = 600 and 1000 best 9/15. After the fix, re-upload the service trace and reset log, update `author/probes/local-data-hashes.txt`, and re-probe.
- 5.1 saved 2026-11-05 09:43 (`author/5.1-your-steps-20261105-094312.txt`). To edit: line 5 typo "time for are"; line 4 names "236 µs shortest gap", now about 600 µs. Copy the final text into `references/steps.md` verbatim.
- Next action: blind test running on the fixed public files (3 fresh Opus subagents, public files only, scored with `score.py`; differs from the real box: no gcc locally). Then re-upload the two changed files and re-probe; 5.1 edits; `gold.c` into 5.2; 5.3 three near misses; 5.4 harness + header + steps with Fill; 6 Verify; check the Try-the-box command box holds no answer; decide how to get 6 Opus runs, since Run submits.

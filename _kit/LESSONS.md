# Lessons from earlier tasks

Keep only lessons that change what is done next time. One or two lines each, with the task they came from. Merge duplicates, and delete any lesson that later proves wrong.

## Order of work

- Before designing anything, run a first Try-the-box probe. Get tool versions, the generated board files, and whether the setup hook ran. Pull the grader's build command from the front-end bundle (see DOP-PLATFORM.md). (driver_peripheral)
- Choose the board by what the emulator really models. QEMU stm32f405 leaves RCC, GPIO and DMA as unimplemented stubs, which read 0 and so hang polling loops. lm3s6965evb models sysctl, GPIO, UART, SSI with an SD card, and an OLED. (driver_peripheral)
- Before Run, use Try the box to check that the model's box holds the current starter and every tool the prompt relies on. In `Zephyr build test`, four runs scored 0 for two reasons: the box still had an old multi-file starter, while the grader compiles one file, and it had no Python. (Zephyr build test)
- Use Verify for every grader or prompt change. It is cheap, and it is the only real end-to-end route when the author has no hardware or local toolchain. Run only when the package is final, because Run submits. (driver_peripheral)
- Before reinstalling Windows or moving to another PC, copy `%USERPROFILE%\.claude` along with the task folders. Sessions and auto-memory live there, not in the repo; after the 2026-11-01 reinstall none were left on any drive. (realtime_budget)
- On Windows, VS Code's C/C++ extension (cpptools) holds open handles on MSYS2 programs, so they fail with "Device or resource busy". It grabs them again after a restart; Restart Manager names the holder. Disable the extension for the workspace before using an MSYS2 toolchain. (HDL_mw32jhhu)
- Platform graders assume a throwaway box and leave build output behind. The RTL `report.py` leaves a 0.83 GB `rtl-*` folder in `/tmp` per run, and local grading filled 51 GB of `C:\msys64\tmp` in one day. Run local graders with `TMPDIR` set to a fresh folder per run, delete it afterwards (also on failure), and don't edit the grader itself. (HDL_mw32jhhu, HDL_mw3o014d_Trung)
- Ask the user before installing a system-wide toolchain such as MSYS2 or WSL. Say where it goes and roughly how much disk it and its build output will use. Afterwards, record the install and its location in `TASK-NOTES.md`. (HDL_mw32jhhu)
- Don't name a Verilog module `design`, even though the RTL shell's template does: it is a reserved word. Test probe code locally before spending a Try the box on it. (HDL_mw32jhhu)
- When a builder screen is new, also save it as HTML, and test the extension's page code on it with scripts removed. The stand-in missed the first-time button texts ("Try the box", "Verify my task"), the section list hidden at 960 px or less, and 5.2's own upload input. (HDL_mw3o014d_Trung)
- Commit a task folder before scripts rewrite its data, and have scripts write to a new file first. A crashed edit emptied an untracked `reset_log_3.2.0.csv`, leaving the builder's upload as the only copy. (realtime_budget)
- Before Run, grade a second valid solution written differently from gold: other register orders and idioms the documents allow, or blind-test firmware. Gold passing shows one route works. Gold set DIR before PA3's level, so Verify stayed clean while the strongest model's six runs all lost `oled_cs_ok`. (driver_peripheral)

## Grader (drive.py)

- Grade the firmware's actual behaviour (QEMU `-trace memory_region_ops_write`, SD trace events, data on the card image), never the model's self-report. (driver_peripheral)
- Emulator reset values can differ from silicon. QEMU sets RCC to 0x078E3AC0, but the chip resets to 0x078E3AD1, so a missing MOSCDIS clear went unpunished. Compare key reset values with the datasheet.
  - A `-device loader,data=` write is overwritten by the reset. A 24-byte RAM shim plus a PC loader worked.
  - Give the solver the same run script so both see the same machine. (driver_peripheral)
- A chip-select check reads the level written, whatever the pin's direction (reviewer's instruction). QEMU's PL061 drops GPIODATA writes to non-output pins, and setting a pin high before making it an output is common practice. Keep two values: address-masked for rules, also direction-masked for modelling the emulated device. (driver_peripheral)
- Copy an emulator quirk into a rule only if the documents require that behaviour. For each modelled register, ask whether code the datasheet allows would fail on the quirk alone. (driver_peripheral)
- Emulator peripheral quirks: QEMU ssi-sd needs one more clocked byte with CS low after each response, or it swallows the next command. Put the workaround in the starter with a comment. A model that rewrites the driver may delete it; one Qwen run lost the whole card path that way. (driver_peripheral)
- Bound the driver against runaway firmware. Per-run time budgets, a trace-size limit, and freeing traces between runs keep the total well under the 300 s test timeout and the memory limit.
  - Without these, a firmware with a 200 000-retry loop most likely made drive.py fail completely, and the run scored 0.00 instead of ~0.125. (driver_peripheral)
- No vacuous passes: a rule about a phase counts only if that phase ran. Don't let an unrelated failure, such as a slow card start-up, fail a rule that was still observable. (driver_peripheral)
- Randomise data and addresses per run, and include boundary cases (blocks above 2 GiB, the last blocks, a card swap and re-init) so hard-coded answers fail. (driver_peripheral)
- Test drive.py's logic on the host with hand-written traces (`author/test_drive_local.py` pattern). It is narrow evidence, but it catches parsing and rule bugs before spending a Verify. (driver_peripheral)

## Prompt and golden set

- Describe symptoms from the field, not causes. Give the exact build command the grader uses, and the run command. State what the emulator does not model, so the solver knows the documents are the source of truth. (driver_peripheral)
- Use real vendor documents (datasheet, errata, board manual) in `/app/files`. A strong task needs an erratum or a board-specific detail that a generic answer misses. (driver_peripheral)
- Don't let each symptom map to one check, and don't state facts the solver could find, such as the silicon revision. The reviewer sent this task back because of both: Opus scored 1.00. Use mixed field reports and put such facts in a log, for example a DID0 value. (driver_peripheral)
- Include one fault the prompt doesn't hint at, which shows only when the firmware runs on the bench model. The reviewer asked for it, plus at least 6 Opus runs. This got the task accepted: a line buffer too short for 8-digit block numbers on a 16 GB card failed four of the strongest model's six runs. (driver_peripheral)
- After "Generate checks", re-set every step and re-read the saved table: field names (no stray tabs), bands, Worth, mistake toggles, and texts not swapped. The extension's Fill and its capture table do both. (driver_peripheral)
- 5.1 describes how a good engineer solves the task, so naming a method is fine there. Each 5.4 text labels one check, so it must state what that check measures: no more and no less. "Generate checks" shortens 5.1 lines and can drop the part the check depends on. Here the clock and re-init texts lost theirs. After generating, agree one final 5.4 text per step and set it with Fill. Wording never changes a "value between" score. (driver_peripheral)

## Model behaviour seen in runs

- Before filling section 5, blind-test the public files with fresh Opus subagents, scored locally. It takes minutes and has no platform side effects. (realtime_budget)
- A task answered by calculation from supplied files is hard to make hard. `realtime_budget` went through three designs: a stated load, a register-only mode, then raw-address tables. Opus scored 1.000 in 9 of 9 runs, under 5 minutes each: it reads every source and document and checks its own script against the traces. Hiding a fact better in the same files did not help. Judge difficulty against the brief's own rule, which can differ per brief, and blind-test weaker models too. (realtime_budget)
- An RTL change with complete documents is solved by careful agents, even when the facts are hidden. In `HDL_mw32jhhu`, 12 of 12 blind solvers (Opus and Sonnet) scored 1.00 across three versions in 6–29 minutes:
  - v1: a port to a new SRAM;
  - v2: a latency budget that forces a bypass;
  - v3: a retry mode, with the read-after-write rule only in a bus capture.

  Each solver wrote its own model of the device from the documents, tested it with random traffic, and read every file, CSV included. Blind-test before building more versions. (HDL_mw32jhhu)
- A cycle-exact rule list in the change request is solved even faster, however subtle the rules. `HDL_mw3o014d_Trung` design A (launch-time scheduling: wrap-safe compares, deciding against the next cycle's counter, drops during backpressure) went 4 of 4 at 1.00 (Opus 6.5 and 13.5 minutes, Sonnet 3–4). A rule written in the ECR is read off, not worked out. (HDL_mw3o014d_Trung)

- The 30-minute working time binds. One Qwen run spent 21 minutes reading PDFs and submitted untested code, while Opus finished in about 7 minutes. Large documents raise difficulty for weaker models. (driver_peripheral)
- Score spread from 8 trace-based checks: Opus 1.00, Kimi 0.75 and 0.75, Qwen 0.00–0.375. Mean 0.43, 1 of 9 runs fully passed. (driver_peripheral)
- Read the strongest model's transcript before adding difficulty. Opus read the documents closely but tested little: repeated-byte data, the card sizes in the run script's example, no real swap. Place a run-only fault outside those tests. This worked: see the 16 GB result above. (driver_peripheral)
- A check failed by every run of the strongest model is a grader suspect, not proof of difficulty. Replay one of those firmwares against the documents. Results pages have shown no per-check output, so test this before Run, which submits. All six lost `oled_cs_ok` to a grader defect, and the reviewer had to correct the scoring. (driver_peripheral)
- Read an erratum's failure sequence before grading it. LM3SYSCTL#11 looked gradable, but it cannot occur on a firmware that always writes the same crystal value. (driver_peripheral)

## Past tasks

| Folder | Builder id | Title | Brief | Shell / board | Status | Outcome |
| --- | --- | --- | --- | --- | --- | --- |
| `driver_peripheral` | task-mvttqdbt | microSD bring-up on the EK-LM3S6965 | Driver and Peripheral Bring-up ($300) | Firmware on QEMU / lm3s6965evb | Accepted (reviewer's message, reported 2026-11-05) | First version sent back as too easy: Verify gold 1.00, naive 0.13; runs mean 0.43, 1 strict pass of 9, Opus 1.00 in its only run. Rework: Verify gold 1.00, naive 0.10. Strongest model, six runs: four failed on the 16 GB card, single runs on a block past the end or SPI clock change while enabled. Weaker models never handled either card case. Reviewer corrected one grader defect (`oled_cs_ok`) in their own scoring. Exact scores not seen |
| `Zephyr build test` | task-mvr8934a | Repair UART batch processing | "your own" (no listed brief) | Pre-created "Zephyr GHCR test" environment, settings locked; bare-metal firmware on QEMU lm3s6965evb | In review (dashboard 2026-10-30) | Verify: gold 1.00, near miss 0.29, GRADER SOUND. Runs 1, 2, 7 and 8 scored 0 because of a setup defect (see `authoring/platform.json`). Current package `dist/locked-firmware-v7/`; whether it was uploaded and run is not recorded. Reviewer verdict: pending |
| `plc_debugger` | task-mvr6hgkn | not set | Control Logic and PLC Debugger | not chosen | Draft, taken 2026-10-27 | — |
| `HDL_mw32jhhu` | task-mw32jhhu | pktbuf: port the packet buffer to the rev C SRAM | HDL feature development (Verilog) ($450) | RTL · terminal (Icarus + Verilator, rtl.json grader) | In review (Run 2026-11-05) | Verify: gold 1.00, mistakes 0.00–0.90. Local blind solvers 12 of 12 at 1.00 across v1–v3. Runs: Kimi 0.80 and 0.00 (both used the full 60 min), Opus 1.00 in 12 min (one run), Qwen 6 of 6 failed with harness or transport errors. Verdict: pending |
| `HDL_mw3o014d_Trung` | task-mw3o014d | not set | HDL feature development (Verilog) ($450), second take | RTL · terminal (expected; not yet seen) | Draft, 1.1 read 2026-11-05 | — |
| `HDL_mw3wykhl_Yeal` | task-mw3wykh1 (digit 1; the folder has a letter l) | not set | HDL feature development (Verilog) ($450), third take | RTL · terminal (expected; not yet seen) | Draft, 1.1 read 2026-11-05 | — |
| `realtime_budget` | task-mvr6ixva | ECP-300 coolant pump resets after software 3.2.0 | Real-Time Budget Planner | C harness with budgets (gcc box, harness.c grader) | Draft; third design uploaded, Verify GRADER SOUND 2026-11-05 (gold 1.00, naive 0.21/0.89/0.21/0.42). Not run | Blind tests (local): Opus 1.000 in 9 of 9 runs across three designs; on the third, Sonnet 1.000/0.842/1.000, Haiku 0.421/0.263/0.105. Not submitted |

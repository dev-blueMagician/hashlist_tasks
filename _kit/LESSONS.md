# Lessons from earlier tasks

Keep only lessons that change what is done next time. One or two lines each, with the task they came from. Merge duplicates, and delete any lesson that later proves wrong.

## Order of work

- Before designing anything, run a first Try-the-box probe. Get tool versions, the generated board files, and whether the setup hook ran. Pull the grader's build command from the front-end bundle (see DOP-PLATFORM.md). (driver_peripheral)
- Choose the board by what the emulator really models. QEMU stm32f405 leaves RCC, GPIO and DMA as unimplemented stubs, which read 0 and so hang polling loops. lm3s6965evb models sysctl, GPIO, UART, SSI with an SD card, and an OLED. (driver_peripheral)
- Use Verify for every grader or prompt change. It is cheap, and it is the only real end-to-end route when the author has no hardware or local toolchain. Run only when the package is final, because Run submits. (driver_peripheral)

## Grader (drive.py)

- Grade the firmware's actual behaviour (QEMU `-trace memory_region_ops_write`, SD trace events, data on the card image), never the model's self-report. (driver_peripheral)
- Emulator reset values can differ from silicon. QEMU sets RCC to 0x078E3AC0, but the chip resets to 0x078E3AD1, so a missing MOSCDIS clear went unpunished. Compare key reset values with the datasheet.
  - A `-device loader,data=` write is overwritten by the reset. A 24-byte RAM shim plus a PC loader worked.
  - Give the solver the same run script so both see the same machine. (driver_peripheral)
- Emulator peripheral quirks: QEMU ssi-sd needs one more clocked byte with CS low after each response, or it swallows the next command. Put the workaround in the starter with a comment. A model that rewrites the driver may delete it; one Qwen run lost the whole card path that way. (driver_peripheral)
- Bound the driver against runaway firmware. Per-run time budgets, a trace-size limit, and freeing traces between runs keep the total well under the 300 s test timeout and the memory limit.
  - Without these, a firmware with a 200 000-retry loop most likely made drive.py fail completely, and the run scored 0.00 instead of ~0.125. (driver_peripheral)
- No vacuous passes: a rule about a phase counts only if that phase ran. Don't let an unrelated failure, such as a slow card start-up, fail a rule that was still observable. (driver_peripheral)
- Randomise data and addresses per run, and include boundary cases (blocks above 2 GiB, the last blocks, a card swap and re-init) so hard-coded answers fail. (driver_peripheral)
- Test drive.py's logic on the host with hand-written traces (`author/test_drive_local.py` pattern). It is narrow evidence, but it catches parsing and rule bugs before spending a Verify. (driver_peripheral)

## Prompt and golden set

- Describe symptoms from the field, not causes. Give the exact build command the grader uses, and the run command. State what the emulator does not model, so the solver knows the documents are the source of truth. (driver_peripheral)
- Use real vendor documents (datasheet, errata, board manual) in `/app/files`. A strong task needs an erratum or a board-specific detail that a generic answer misses. (driver_peripheral)
- After "Generate checks", re-set every step and re-read the saved table: field names (no stray tabs), bands, Worth, mistake toggles, and texts not swapped. The extension's Fill and its capture table do both. (driver_peripheral)
- 5.1 describes how a good engineer solves the task, so naming a method is fine there. Each 5.4 text labels one check, so it must state what that check measures: no more and no less. "Generate checks" shortens 5.1 lines and can drop the part the check depends on. Here the clock and re-init texts lost theirs. After generating, agree one final 5.4 text per step and set it with Fill. Wording never changes a "value between" score. (driver_peripheral)

## Model behaviour seen in runs

- The 30-minute working time binds. One Qwen run spent 21 minutes reading PDFs and submitted untested code, while Opus finished in about 7 minutes. Large documents raise difficulty for weaker models. (driver_peripheral)
- Score spread from 8 trace-based checks: Opus 1.00, Kimi 0.75 and 0.75, Qwen 0.00–0.375. Mean 0.43, 1 of 9 runs fully passed. (driver_peripheral)

## Past tasks

| Folder | Builder id | Brief | Shell / board | Status | Outcome |
| --- | --- | --- | --- | --- | --- |
| `driver_peripheral` | task-mvttqdbt | Driver and Peripheral Bring-up ($300) | Firmware on QEMU / lm3s6965evb | Submitted 2026-10-30, in review | Verify: gold 1.00, naive 0.13. Runs: mean 0.43. Reviewer verdict: pending. Grader fix prepared in `corrections/` |
| `Zephyr build test` | not recorded | not recorded | locked firmware environment (see its README) | not recorded | not recorded |

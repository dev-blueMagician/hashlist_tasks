# Task notes

Authoring notes only; keep outside the solver upload.

## Task and current state

- Required behavior and the work the solver must do: repair the legacy microSD firmware `/app/firmware.c` for the EK-LM3S6965 (Rev A2) so it meets the stated clock, UART, SPI and card-type requirements on the hardware, keeping the UART protocol (see "Task design").
- Allowed changes and deliverable: any change to `/app/firmware.c`; only that file is collected (answer file `/app/firmware.c`, 5.2).
- Task identifier and current package or revision: DOP builder `task-mvttqdbt`; local package `package/` (hashes in the evidence sections below).
- Platform state and save confirmation: Run pressed by the user 2026-10-30; task "In review" ("With a reviewer … Nothing is needed from you until they are done", `author/scre.html`). Editing assumed locked. Uploaded drive.py = f48a94a1… (Verify 2 revision).
- Run side effects and existing authorization: screen 1.3 "Pressing Run also hands the task in for review." The user pressed Run; the task is submitted.

## Environment and submission contract

| Item | Model environment | Grader environment | Evidence |
| --- | --- | --- | --- |
| Target, OS or RTOS, and toolchain | QEMU 7.2.22 lm3s6965evb (Fury Rev A2 model), arm-none-eabi-gcc 12.2.1, newlib 3.3.0, Debian 12 runtime image | same gcc/QEMU packages on python:3.12-slim-bookworm verifier image | probe 1 apt log; Verify 1 log |
| Required commands and installed dependencies | gcc, QEMU, python3 3.11, git, pdftotext, timeout; no make/gdb | gcc, QEMU, Python 3.12, pytest 9.1.1 | probe 1; Verify 1 |
| Working directory and visible files | `/app`: `data/` (link.ld, run.sh, start.c, uart.h, run-sd.sh, starter/firmware.c), `files/` (3 TI PDFs), `firmware.c` and `build/` from setup.sh | `/tests` (verifier files incl. drive.py, board.py, start.c, link.ld, uart.h); `/app/firmware.c` from the run | checksum run 17:30; board.py template |
| Startup, linker, libraries, and generated inputs | /app/data/start.c (reset → app_main, 2-entry vector table), link.ld | /tests/start.c, /tests/link.ld (grader's own copies; assumed equal) | screen 3.1; template |
| Compile and link command | prompt: `cd /app/build; arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -Os -ffreestanding -fno-tree-loop-distribute-patterns -nostdlib -I/app/data -T /app/data/link.ld /app/data/start.c /app/firmware.c -lgcc -o firmware.elf` | board.build: same flags with /tests paths, `-o /tmp/built` | front-end template; Verify 1 builds gold/naive |
| Run, simulate, or flash command | `sh /app/data/run-sd.sh firmware.elf card.img [v1]` (RCC shim, SD card) | `python3 /tests/drive.py /tmp/built` (own QEMU runs with shim, traces, QMP card swap) | probes 3–4; test_outputs.py |
| Transport and synchronization | UART0 on stdio, line protocol, `READY` after reset | same; drive.py waits for READY, 20 s per reply | drive.py |
| Time, memory, network, and other limits | 2 CPU, 2 GiB, 8 GiB disk, internet off, working time 30 min; step limit and grader timeout: confirm saved values (recommended 100 steps, 15 min) | drive.py timeout 300 s in test_outputs; build 180 s | 2.2, 2.3, test_outputs.py |

- Locked files and editable files: `/app/data` and `/app/files` are root-owned (read-only for the model's user); `/app/firmware.c` and `/app/build` are created by setup and handed to the model's user.
- Public archive layout and answer path: answer file `/app/firmware.c`.
- What the grader collects and compiles: `/app/firmware.c` with the grader's start.c and link.ld.
- Brief/environment discrepancies and their resolution: brief's `answer.json` replaced by grading the firmware's actual register trace (stronger than a self-report); brief's "naive < 0.3" kept although the builder suggests one mistake per common-mistake answer.

Builder sections observed: 1 Brief (1.1 What good looks like, 1.2 A worked example, 1.3 How a run works), 2 Build settings (2.1 Shell, 2.2 Limits, 2.3 Internet, 2.4 Toolchain), 3 Environment, 4 Prompt, 5 Golden set, 6 Verify, 7 Run.

Worked example (1.2, screenshots):
- Container: `FROM python:3.12-slim@sha256:...`, `WORKDIR /app`, `COPY environment/data /app/data`; cpu 1, mem 2 GiB, timeout 900 s, steps 40, network off. Data in box; answers and checks not.
- Golden set: gold + naive_a (wrong cause) + naive_b (right cause, wrong number).
- Checks: one pytest per step, numeric ranges (e.g. `window_ms` (450, 550)), substring check on text field.
- Result: gold 1.00 strict pass, naive_a 0.33, naive_b 0.67, "separation 0.33 sound". Note brief requires naive < 0.3 — stricter than the example.

Shell 2.1 (HTML paste): currently selected = Python (default). Other options include "Firmware on QEMU or Renode" (Requires C and Python) — the likely fit for this brief; its setup details not yet captured.
Python shell contract (from "What the Python shell sets up"):
- Agent tools: `bash(command)`, `view_image(path)`, `submit(notes)`; bash under /app.
- Scoring: pytest, one check per criterion; reward = fraction passed; strict pass = all.
- Files: `agent/PROMPT.md` (author), `environment/Dockerfile` (generated), `environment/data/` (author), `references/gold.py`, `references/naive_a.py` (author, withheld), `verifier/test_outputs.py`, `verifier/report.py`, `verifier/Dockerfile` (generated, withheld), `task.json` (generated), `/app/answer.txt` (agent, `Label: value` per line).
- Defaults: python:3.12-slim, 1 CPU, 1 GiB, 4 GiB disk, 40 steps, internet off.
- Discrepancy: brief says `answer.json` with register write sequence; Python shell answer path is `/app/answer.txt`. Firmware shell contract may differ — must check.

Firmware on QEMU or Renode shell (2.1 HTML paste, now selected, defaults not yet accepted):
- Container: board's cross compiler + QEMU or Renode. Defaults debian:12-slim, 2 CPU, 2 GiB, 8 GiB disk, 40 steps, internet off. Toolchain/QEMU versions: unknown.
- Agent writes a single file `/app/firmware.c`. Board files generated under `/app/data`: `start.c`, `link.ld`, `uart.h`, `run.sh` (`board.resc` on Renode). Their contents: unknown — needed to know entry point, vector table, UART API, build command.
- Grading: `verifier/drive.py` (author, withheld) runs the built image, exchanges bytes on the UART, prints `metric=value` lines; `verifier/board.py` (generated helper); `verifier/test_outputs.py` (generated) builds firmware, runs drive.py, checks each metric against a budget band. Reward = fraction of metrics in budget; strict pass = all.
- References: `references/gold.c`, `references/naive_a.c` (author, withheld).
- Board select default value: `lm3s6965evb` (QEMU). List includes netduinoplus2 (STM32F405), stm32f4_discovery, netduino2 (STM32F205), stm32vldiscovery, microbit, mps2/mps3, RA2E1/RA6M5, nucleo_f767zi, nucleo_wba52cg, AVR, SiFive E, OpenTitan.
- Discrepancies with brief:
  - Brief: grader compares register write sequence and inter-write delays; shell grades UART-reported metrics. Unknown whether drive.py/board.py can pass QEMU trace options (e.g. MMIO write tracing) or read a trace file. If not, register order must be observed by other means; firmware self-reporting its writes would be gameable.
  - Brief: model writes `answer.json`; shell collects `/app/firmware.c`. Unknown whether any other file is collected.
  - 2.1 now shows as done (2.2 paste). Board actually saved: unknown (last seen `lm3s6965evb`, the default).
  - Board must have a QEMU model of the chosen peripheral; QEMU peripheral models do not implement silicon errata, so an errata behaviour would need to be represented another way (unknown/undecided).

Limits 2.2 (HTML paste): CPU 2, Memory 2 GiB, Disk 8 GiB, Step limit 40, Working time 30 min (fixed by template, not editable). Grader timeout select carries `value="600"`, which is not one of its options (120/300/900/1800/3600) — saved value ambiguous; set explicitly. Recommended: grader timeout 900 s, step limit 100; others default.

## Verification evidence

| Check | Revision and command or action | Result and evidence |
| --- | --- | --- |
| Starter baseline and expected missing or incorrect behavior | probe 4, runtime image, drive.py 6b7b87ab…, `-O2 -nostdlib` (not the grader's -Os; not through Verify) | 1/8 = 0.125: IOSC clocking (UART 80 576 baud at the slow corner, id clock 280–520 kHz), no PLL, SDHC wrong blocks, v1 rejected, SSICPSR written with SSE=1, PA3 SSI0Fss, stale fast clock on re-init. Intended failures, no incidental setup failure. |
| Exact public starter plus allowed solution passes the actual grading route | Verify 1, 20:30 (gold.c derived from the starter by editing firmware.c only) | gold reward 1.00, strict true; also 8/8 in probe 4 at -O0/-O2/-Os/-nostartfiles |
| Gold meets the expected criteria | Verify 1 step table | ✓ on all 8 steps |
| Required near misses fail the intended criteria | Verify 1 | naive_a reward 0.13 (< 0.3); fails 7 steps for the TM4C123-style clock (invalid PLL reference), missing LDO errata, odd prescaler, SSE reconfiguration, PA3 SSI0Fss, stale re-init; passes rcgc_delay_ok as marked |
| Boundary and repeated-operation checks relevant to this task | drive.py design, exercised in probe 4 and Verify 1 | random block content each run; blocks above 2 GiB on SDHC and near the end of each card; read-back after write; stray-write check from the SD trace; QMP card swap (SDHC → SDSC) then re-init and reads |
| Saved platform files and generated checks match the tested revision | checksum run 17:30 (starter 76a2433a…, run-sd.sh ff27f652…, firmware.c = starter); 5.4c page shows the new drive.py (`find_elf`) and the generated test_outputs.py reading the 8 fields with band 1..1 after the user's fixes | gold/naive/drive.py content on the platform confirmed by Verify behaviour and the saved page, not by hash. Prompt re-paste pending (path wording), then a second Verify. |

## Author workstation (observed 2026-10-29, `Get-Command`, `wsl -l -v`)

- Windows 11, Python 3.12.15 (uv), git present.
- Not present: arm-none-eabi-gcc, gcc, make, qemu-system-arm, renode, docker. WSL binary present but no distribution installed.
- Consequence: no local cross-build or QEMU run is possible; local checks are limited to Python logic (e.g. grader parsing against hand-written traces). End-to-end evidence must come from the platform's Verify step (section 6) unless a toolchain is installed locally.

- User decisions (2026-10-29): rely on the platform Verify step only (no local toolchain install); AI assistance is fully allowed (user statement; notice text itself not seen).
- Internet 2.3 (HTML paste): off (`aria-checked="false"`). Keep off. All docs, SDK files and data must be inside `environment/data`. Whether the image build itself has internet: not stated.
- 2.2 shown as done; whether timeout 15 min / steps 100 were applied: unconfirmed — check in a later summary or `task.json`.
- Local evidence possible: Python 3.12 only — host-side unit tests of drive.py parsing/metric logic on sample text. Not a substitute for the build/QEMU route.
- Toolchain 2.4 (HTML paste): mode "Describe it"; base image `debian:12-slim@sha256:3783cc01…`; apt pinned to snapshot.debian.org 20261006T000000Z (bookworm); packages `gcc-arm-none-eabi, libnewlib-arm-none-eabi, qemu-system-arm`; generated Dockerfile ends `WORKDIR /app`, `COPY environment/data /app/data`. No python3, git or PDF tools in the box by default. "Try the box" builds the image and runs listed commands (status: "Template box, already checked"); it does not submit (per its description).
- 2.4 change applied: packages now `gcc-arm-none-eabi, libnewlib-arm-none-eabi, qemu-system-arm, python3, git, poppler-utils`. Try the box with `author/try-box-probe-1.txt` ran: "Worked · 02:26 PM", 1122 lines, 13 steps; 2.4 shows "The box was tried and works". Image `dop-task-task-mvttqdbt-runtime:dev` built on Daytona.
- Versions seen in the apt log: gcc-arm-none-eabi 15:12.2.rel1-1, binutils-arm-none-eabi 2.40-2+18+b1, python3 3.11.2, git 2.39.5, libpoppler126 (poppler-utils), perl 5.36. `make` not installed. QEMU version line and all 13 command outputs: not yet received (paste truncated during apt log).
- Author has no MCU hardware (user statement, 2026-10-29). Task must rest on public sources (RM, errata, SDK releases) and the emulator; no silicon confirmation possible. Do not present it as first-hand hardware bring-up.

## Task design (draft, 2026-10-29)

Repair/bring-up task on the EK-LM3S6965 (QEMU lm3s6965evb). Legacy firmware (`starter/firmware.c`) serves the microSD over SSI0 with a UART line protocol but runs from the internal oscillator, treats every card as SDSC, rejects v1 cards, reprograms SSI0 while enabled, and routes PA3 (OLED CS) to SSI0Fss. Requirements in the prompt: 50 MHz from the 8 MHz crystal via the PLL, UART 115200 8N1 within ±2 %, identification 100–400 kHz, data 10–25 MHz, SDSC/SDHC/v1 support; field reports describe symptoms only.

Local package (`package/`, upload targets in brackets):
- `environment/data/docs/` [`/app/data/docs/`]: lm3s6965-datasheet.pdf (sha256 C3BFE9F1BCFB128F…), spmz860-stellaris-errata.pdf (53CA81D58C7250A5…), spmu029-ek-lm3s6965-users-manual.pdf (A915444A20FE3EE7…) — unaltered TI PDFs.
- `environment/data/starter/firmware.c`, `environment/data/run-sd.sh` [`/app/data/…`].
- `hooks/setup.sh` [hooks/setup.sh]: copies the starter to `/app/firmware.c` if absent; creates `/app/build`.
- `references/gold.c`, `references/naive_a.c`, `verifier/drive.py` [golden set / verifier, section 5].
- `agent/PROMPT.md`: not written yet (needs the grader's build command).

Checks printed by drive.py (1 = pass), each traced to a document:
1. `card_io_ok` — data/type correct on SDHC 4 GiB, SDSC 64 MiB, SD v1 32 MiB (random blocks, stray-write check); ≥74 clocks CS high before CMD0; CMD0/CMD8 CRC; HCS on SDHC; PD0/PA2/PA4/PA5 pin setup; clocks enabled before access; every UART byte at 115200 ±2 % with the latched divisor at the actual clock; data-phase SSIClk 10–25 MHz and ≤ SysClk/2.
2. `clock_ok` — never an invalid clock (e.g. PLL/raw MOSC with MOSCDIS=1); 50 MHz at every UART byte and SSI frame.
3. `ldo_errata_ok` — LDOPCTL=0x1B before the first PLL power-up (LM3SYSCTL#09).
4. `id_clock_ok` — last 10 CS-high frames before CMD0 and CS-low frames to the ACMD41 R1 at 100–400 kHz (CPSDVSR LSB cleared, IOSC ±30 % if used).
5. `ssi_reconfig_ok` — no SSICR0/SSICPSR write with SSE=1 (datasheet 13.4).
6. `oled_cs_ok` — no SSI frame while PA3 is SSI0Fss or driven low (board manual table 2-2).
7. `reinit_ok` — second `I` on SDHC returns OK, identification again 100–400 kHz, data read correct.
8. `rcgc_delay_ok` — singlestep timing run: ≥3 instructions or a System Control read between an RCGCn enable and the module's first access (3-system-clock rule); UART0 and SSI0 must be exercised.
Rules 4–7 fail if no card was ever initialised (no vacuous passes). Measured in probe 4 (runtime image): gold 8/8; naive_a (TM4C123-style RCC2 PLL without MOSCDIS clear/LDO, SD fixes, legacy SSI/pins) 1/8 = 0.125; starter 1/8. `reinit_ok` swaps the SDHC card for an SDSC card via QMP before the second `I`.

Evidence so far: host-only `author/test_drive_local.py` (18 checks: CRC7, clock model, PL061 masking, rule triggers) passes — narrow evidence, no firmware or QEMU involved.

Probe 2 (Try the box, 12 commands, saved `author/try-box-2-output.html`, run 15:47–15:49):
- Box state: runs as root; `/app/firmware.c` (starter) and `/app/build` existed, so the setup hook runs in Try the box. `/app/files/*.pdf`, `/app/data/starter/firmware.c`, `/app/data/run-sd.sh` present with the local SHA-256 values.
- All 10 builds succeeded (`-mcpu=cortex-m3 -mthumb -O0/-O2/-Os -ffreestanding -nostdlib -T /app/data/link.ld /app/data/start.c X.c`, and `-nostartfiles` with newlib), no warnings printed. Sizes 1.4–3.3 KB text.
- Defect found: every firmware answered `I` with `ERR 3`. QEMU's ssi-sd consumes one transfer after a response before it accepts the next command; `sd_command` sent CMD8 straight after CMD0's R1, so QEMU logged `CMD00 arg 0x0001aa87`. Also a real SD-spec requirement (NRC ≥ 8 clocks). Fix: `sd_command` now clocks 0xFF until the card returns 0xFF before each command (starter, gold, naive).
- Defect found: QEMU resets RCC to 0x078E3AC0 (MOSC on and selected) while the datasheet reset value is 0x078E3AD1 (MOSCDIS=1, IOSC). Read-modify-write code therefore never saw MOSCDIS=1 and naive_a scored clock_ok=1. Fix: drive.py and run-sd.sh add `-device loader,addr=0x400FE060,data=0x078E3AD1,data-len=4`. QEMU RCC2 reset 0x07802810 matches the datasheet. QEMU masks LDOPCTL writes with 0x1F.
- Trace format confirmed: `sdcard_normal_command SPI        GO_IDLE_STATE/ CMD00 arg 0x00000000 (state idle)`; QEMU logs `sdcard_reset`/`sdcard_powerup` on CMD0.
- With init broken, the rule logic still behaved as designed: gold clock_ok=1, ldo=1, rcgc=1, no rate/OLED/reconfig violations; naive ldo=0, id clock 403 226 Hz (CPSR 125 → 124), PA3 SSI0Fss flagged; starter IOSC 8.4–15.6 MHz, id clock 280–520 kHz, PLL never used. Each drive.py run took about 1 s.
- Try the box limit observed: at most 20 commands.

Probe 3 (18 commands, saved `author/try-box-3-output.html`, 16:55):
- NRC fix works: gold initialises SDHC (`OK SDHC`), SDSC and v1 (`OK SDV1`); read/write correct, written bytes confirmed in the image at block 7. Trace formats confirmed: `sdcard_read_block addr 0xa00 size 0x200`, `sdcard_write_block addr 0xe00 size 0x200`, `sdcard_app_command SPI SD_SEND_OP_COND/ACMD41 arg 0x40000000 (state idle)`.
- Loader approach failed: the loader's write (`cpu -1`, 0x78e3ad1) is followed by QEMU's System Control reset; the firmware read 0x78e3ac0. naive_a therefore scored card_io_ok=1, clock_ok=1 (2 + rcgc = 3/8). Replaced by a 24-byte RAM shim (loader `file=` at 0x2000FF00 plus `addr=0x2000FF01,cpu-num=0` to set the PC) that writes RCC=0x078E3AD1 and jumps to the reset vector; same shim in run-sd.sh (printf octal). Host check confirms identical bytes.
- Re-init failure was a QEMU quirk: after the card has been in transfer state, CMD0's R1 reports the pre-command state (idle bit clear), so a single CMD0 returns 0x00 where a real card returns 0x01. reinit_ok now swaps the card through QMP (`blockdev-change-medium` sd0 → a 64 MiB SDSC image; the SD model resets on insertion) and expects `OK SDSC` plus correct data — the realistic card-swap case, and it also catches stale card-type state.
- drive.py fix: the data-phase window ended at the next CMD0 byte and so included the re-init session's selected 0xFF bytes at 400 kHz; it now ends where the next session's deselected power-up clocks begin. Retried CMD0s are grouped into one session.
- naive_a otherwise failed as designed: LDOPCTL=0 at PLL power-up; identification 403 226 Hz; SSICPSR written with SSE=1; PA3 as SSI0Fss; re-init at 25 MHz. starter: UART 80 576 baud at the slow IOSC corner, PLL never used.
- One "failed" command in that probe was only grep's exit status (no matching lines).

Probe 4 (17 commands, saved `author/try-box-4-output.html`, 17:08, all commands exit 0) — files tested, SHA-256: starter 76a2433a…, gold f2063e16…, naive_a 1f80de21…, drive.py 6b7b87ab…, run-sd.sh ff27f652… (equal to the local package):
- Shim works: first RCC write is the shim's 0x78e3ad1 (cpu 0); gold then writes LDOPCTL 0x1b and RCC 0x78e3ad1 → 0x78e3ad0 → 0x78e1b80 → 0x1ce1b80 → 0x1ce1380. naive_a writes RCC 0x78e3b91 (MOSCDIS=1) and RCC2 0x87802810 … 0xc1c00000. run-sd.sh shim file sha256 3ade6da3…, bytes as intended; gold via run-sd.sh: READY / OK SDSC / DATA.
- Scores in the runtime image with `arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -O{0,2,s} -ffreestanding -nostdlib -T /app/data/link.ld /app/data/start.c X.c` (grader's real command still unknown): gold 8/8 at -O0, -O2, -Os and with -nostartfiles (newlib); naive_a 1/8 = 0.125 at -O0, -O2, -Os (only rcgc_delay_ok passes); starter 1/8 = 0.125 at -O2. drive.py ≈ 0.4 s per firmware.
- Not yet shown: the same in the verifier image (python:3.12-slim) through the platform's generated test_outputs.py; budgets; Verify.

## Section 3.1 Files (saved page `author/screen-3.html`, 2026-10-29)

- "Build a new one" selected; optional name saves it under My environments. File tree `/app/data` = link.ld, run.sh, start.c, uart.h (editable, deletable); New file / Upload files / Upload a folder.
- Optional hidden hooks: `hooks/setup.sh` (as root in the workdir, before the model's first step) and `hooks/teardown.sh` (after its last step, before the answer file is read). Both also run for the correct answer and each common mistake. A failing setup = run error; a failing teardown = no answer, score 0. What setup creates under the workdir is handed to the model's user (editable); anything else stays root's. A teardown that writes the answer file overrides a reference answer.
- Inference: the model runs as a non-root user; `/app/data` (root, 644) is read-only to it. Starter `firmware.c` should be created by setup.sh in the workdir.
- Upload behaviour (user screenshots, 2026-10-29): uploading the docs folder put the PDFs in `/app/files/` ("over 2 MB" / "not text, so it is in /app/files/…"); text files stay under `/app/data`. File tree now: `/app/data/{link.ld,run.sh,start.c,uart.h}`, `/app/files/{lm3s6965-datasheet.pdf, spmu029-ek-lm3s6965-users-manual.pdf, spmz860-stellaris-errata.pdf}`. Environment name saved ("EK-LM3S6965…"). The prompt must cite `/app/files/…`. Whether `/app/files` is present in the model box: to confirm in probe 2.
- Hook boxes show grey placeholder text (a Zephyr example); not saved content.
- Local SHA-256 for comparison: starter/firmware.c 453eea4c…, run-sd.sh 98fe280f…, datasheet c3bfe9f1…, user manual a915444a…, errata 53ca81d5…. All package text files use LF line endings.
- User approved the task concept (microSD bring-up on LM3S6965 with errata LM3SYSCTL#09, SSI rules, board wiring), 2026-10-29.

## Sections 4–6 (saved pages `author/screen-4.html`, `screen-5.2/5.3/5.4.html`, `screen-6.html`, 2026-10-29; `screen-5.1.html` is a byte-identical copy of screen-4, so 5.1 "Your steps" is not yet seen)

- Checksum run after re-upload (`author/try-box-5-output.html`, 17:30): `/app/data/starter/firmware.c` 76a2433a…, `/app/data/run-sd.sh` ff27f652…, `/app/firmware.c` 76a2433a… (setup hook copied it). Try commands now hold only these three non-secret lines.
- 4 Prompt: 4.1 Task title (input), 4.2 Context (`agent/CONTEXT.md`, optional), 4.3 Prompt (`agent/PROMPT.md`). Guidance: put in the problem, how often it happens and when; leave out the cause, the answer, the method and anything that hints at how it is graded; name the `/app/data` files the model needs.
- 5.2 Correct answer: answer file `/app/firmware.c` (pre-filled); `references/gold.c` textarea/upload. 5.3 Common mistakes: "A full answer with one common mistake in it. One mistake per answer." `references/naive_a.c`; more can be added.
- 5.4 Scored steps: `verifier/drive.py` ("the harness"). "The firmware is built from the agent's /app/firmware.c and this is run with the image as its one argument. It has board(elf, bytes, expected)… every line it prints as metric=value is a field a check below can hold to a budget." Checks (`verifier/test_outputs.py`) are generated from 3–20 steps written in 5.1; "minimum 3 checks". The build command will be visible in the generated test_outputs.py only.
- 6.1 Verify: "Checks the correct answer beats every common mistake"; currently lists 5 problems (empty prompt, gold, naive_a, harness, steps). Cost/limits of Verify: not stated.
- 5.1 Your steps = free text, one step per line (`references/steps.md`); written as eight plain sentences, each tagged "(checked by <metric>)".
- 5.4 after "Generate checks" (`author/screen-5.4b.html`): the generator made 9 steps, 8 of them "the judge reads it" (an LLM judge reading the answer file) and one "a value between" on a field `sysclk` that drive.py never prints; one step demanded gold's LBA-overflow guard. Each step has: text, Checked by (value between / line that contains / judge), field, lowest, highest, Worth (points), and per-mistake "gets it wrong" toggles. Needed settings: `author/steps-settings.md` (8 steps, value between 1 and 1 on each metric, Worth 1, naive_a on except rcgc_delay_ok).
- Generated `verifier/test_outputs.py` ("generated from the criteria in task.json. Edits here are overwritten."): `from board import build`; `build("/app/firmware.c", "/tmp/built")`; then `python3 /tests/drive.py /tmp/built` with timeout 300 s; parses stdout `metric=value` (first value wins), stderr ignored; `test_it_builds` plus one test per value-between step. The build command lives in the generated, withheld `board.py` and is still not visible.
- Grader build command, from the platform's public front-end bundle `https://dop.hashlist.com/assets/templates-Bzqg75dh.js` (board.py template, Cortex-M QEMU variant; read 2026-10-29): `arm-none-eabi-gcc -mcpu=<CPU> -mthumb -Os -ffreestanding -fno-tree-loop-distribute-patterns -nostdlib -I/tests -T /tests/link.ld /tests/start.c <source> -lgcc -o <out>` ("Compile source against the grader's own start.c, link.ld and uart.h"), timeout 180 s. `board()` runs `qemu-system-arm -M MACHINE -nographic -monitor none -chardev stdio,… -serial chardev:uart -kernel elf` (drive.py does not use it). Inference: CPU = cortex-m3 for lm3s6965evb and /tests/start.c, link.ld equal the /app/data copies — to confirm in Verify. Prompt now gives the same command with /app/data paths, output /app/build/firmware.elf. Gold was measured at -Os -nostdlib (probe 4); the extra -fno-tree-loop-distribute-patterns and -lgcc only relax the link.
- 5.4 after the user's edits (`author/screen-5.4c.html`): 8 value-between steps, 1 point each (13 %), naive_a on except rcgc. Defects found: rcgc_delay_ok band 1..0 (impossible, gold would fail); card_io_ok field has a trailing tab ("card_io_ok\t", never matches the stripped label); the card_io and reinit step texts are swapped.
- Verify 1 (6.1, saved `author/screen-6b.html`, 20:28–20:31): both images built; "checking the files the prompt names, and that no answer is in the box" → only "the prompt names /app/build/firmware.elf, and it is not in the box" (a file the model creates; prompt reworded to build inside /app/build with `-o firmware.elf`, needs re-paste and re-verify); "gold reward 1.00 strict true"; "naive_a reward 0.13 strict false"; "gold_in_other_notation … n/a"; "GRADER SOUND — the correct answer scores 1.0 and every wrong one scores less". Step table: gold ✓ on all 8; naive_a ✗ on all except rcgc_delay_ok (its toggle is off, so consistent). The real board.build route (-Os, -nostdlib, /tests start.c/link.ld) therefore builds and grades gold and naive as probe 4 predicted.
- Verify 2 (saved `author/screen-6c.html`, 20:45–20:47), after the prompt re-paste and the user setting 2.2 to the recommended limits (user statement): no problems listed ("The correct answer scores 1.00 and every common mistake scores lower."); the prompt-file check produced no warning; gold reward 1.00 strict true; naive_a 0.13 strict false; same step table as Verify 1; "GRADER SOUND".
- drive.py now accepts the image path or a directory holding the ELF (`find_elf`); sha256 f48a94a1… (re-upload needed; probe-4 version was 6b7b87ab…).
- Tension to resolve: the brief requires a naive answer below 0.3; the builder asks for one mistake per common-mistake answer. A single independent mistake cannot fail ≥6 of 8 independent checks; naive_a (TM4C123-style bring-up plus the untouched legacy SSI/pin code) is one "first answer" with several faults.

## Probe 1 results (Try the box, 2026-10-29, output saved in `author/try-box-1-output.txt`)

- Runtime (agent) image `dop-task-task-mvttqdbt-runtime:dev`: Debian 12.15, arm-none-eabi-gcc 12.2.1 20221205 (15:12.2.rel1-1), newlib 3.3.0-1.3+deb12u1, QEMU 7.2.22 (1:7.2+dfsg-7+deb12u18+b3), Python 3.11.2, git, pdftotext, timeout. No make, no gdb.
- Verifier image `dop-task-task-mvttqdbt-verifier:dev` is separate: `python:3.12-slim-bookworm@sha256:782412e8…` + same snapshot + `gcc-arm-none-eabi libnewlib-arm-none-eabi qemu-system-arm` (same versions as runtime, per apt log) + pytest 9.1.1, pytest-json-ctrf 0.5.2; `COPY verifier/ /tests/`; `mkdir -p /app /out`. Verifier files are not in the agent image.
- Board files for lm3s6965evb (selected board): `link.ld` (flash 0x0 256K, RAM 0x20000000 64K, ENTRY(reset), `.vectors` first); `start.c` (copies .data, zeroes .bss, calls `app_main()`; vector table holds only SP and reset — no fault/IRQ handlers); `uart.h` (UART0 DR/FR, RXFE, TXFF only); `run.sh` = `qemu-system-arm -M lm3s6965evb -nographic -monitor none -chardev stdio,id=uart,mux=off,signal=off -serial chardev:uart -kernel "$1"`. No build script: the grader's compile command is unknown (inside generated `test_outputs.py`).
- QEMU logging works in the runtime image: `-trace memory_region_ops_write` prints absolute address, value, size and region name (e.g. `addr 0x40008010 value 0x2 size 4 name 'pl022'`); reads via `memory_region_ops_read`; `-d unimp` logs placeholder devices. `-icount shift=0 -singlestep -d nochain,exec` gives one exec line per instruction (writes at log lines 6/12/18/225 around a 100-iteration loop), so instruction counts between writes are measurable. SD trace events available (`sdcard_normal_command`, `sdcard_app_command`, `sdcard_response`, `sdcard_read_block`, `sdcard_write_block`, …).
- SD card images accepted on lm3s6965evb: 64 MiB (SDSC) and 4 GiB sparse (SDHC); `-global sd-card.spec_version=1` accepted (SD v1 card).
- netduinoplus2 check: RCC write logged as unimplemented; ADC CCR write lands in an `stm32f2xx-adc` instance; ADC SR reads 0 after SWSTART|ADON (EOC never set) → ADC polling would hang. STM32F405 rejected as target.

## Document facts checked (author scratch copies, not yet in the package)

- LM3S6965 datasheet (ti.com/lit/ds/symlink/lm3s6965.pdf, 761 pages, July 15 2014): IOSC "12 MHz ±30%", fIOSC 8.4/12/15.6 MHz; RCC reset 0x078E.3AD1 (IOSC source, PLL bypassed and powered down, MOSCDIS=1 default "main oscillator is disabled"); §5.3 PLL steps (BYPASS=1/USESYS=0 → XTAL/OSCSRC, clear PWRDN → SYSDIV + USESYS → poll PLLLRIS → clear BYPASS); LDOPCTL VADJ 0x1B = 2.75 V; "delay of 3 system clocks after the module clock is enabled before any module registers are accessed"; §13.4 "Ensure that the SSE bit in the SSICR1 register is disabled before making any configuration changes" and note "The SSI must be disabled … before any of the control registers are reprogrammed"; SSIClk = SysClk/(CPSDVSR×(1+SCR)), CPSDVSR even 2–254, LSB hard-coded to zero; master mode needs SysClk ≥ 2×SSIClk; GPIODATA masked by address bits [9:2].
- Errata SPMZ860 (ti.com/lit/pdf/spmz860, June 2014) covers Fury-class Rev A2. LM3SYSCTL#09 (Fury Rev A2): "Prior to enabling the PLL module … the default LDO voltage setting of 2.5 V be adjusted to 2.75 V using … LDOPCTL". LM3SYSCTL#11 (Fury Rev A2): external reset leaves PLLCFG stale; workaround writes XTAL to a wrong value then the desired one. QEMU lm3s6965evb reports DID0 0x10010002 (Fury, Rev A2) — from QEMU source, not yet confirmed by a run.
- Board wiring (QEMU source comments, to confirm in the EK-LM3S6965 user manual): SD CS = PD0 (active low), OLED CS = PA3 = SSI0Fss, both on SSI0. Main crystal 8 MHz: from memory of vendor examples, unconfirmed.

## Emulator evidence

- QEMU v7.2.0 `hw/arm/stm32f405_soc.c` (fetched from github.com/qemu/qemu, tag v7.2.0; Debian 12 ships 7.2 — container version itself unconfirmed): real models = SYSCFG, USART x8, TIM2–5, ADC x6, SPI x6, EXTI. Placeholders (`create_unimplemented_device`) = RCC, GPIOA–I, I2C1–3, CAN1–2, DMA1–2, PWR, Flash interface, TIM1/6–14, RTC, WWDG/IWDG, DAC, SDIO, CRC, Ethernet, USB, DCMI, RNG. Placeholder writes are ignored and reads return 0 (logged with `-d unimp`), so firmware polling a ready flag there hangs.
- QEMU v7.2.0 `hw/arm/stellaris.c` (lm3s6965evb): real models = sysctl 0x400FE000 (PLL lock bit set immediately when PWRDN cleared), watchdog, GPIO A–G, UART0–2, SSI0 (pl022) 0x40008000, I2C 0x40020000 (no device on bus), GPTM 0–3, ADC 0x40038000, Ethernet. Placeholders: i2c-0 0x40002000, i2c-2, PWM, QEI, comparator, hibernation 0x400FC000, flash-control 0x400FD000. SSI0 bus carries an SD card in SPI mode (`ssi-sd` + `sd-card` with `spi=true`, image via `-drive if=sd`), chip select = GPIO D0 active low, plus the ssd0323 OLED (GPIO C7 to its input 0). This allows behaviour-based grading (data on the card image), not only traces.
- Consequence: QEMU does not reproduce silicon errata; an errata/SDK-change task must be graded on the firmware's register writes (trace) or on behaviour the model really emulates. Whether drive.py can enable QEMU register logging: unknown until run.sh/board.py are seen.

## Section 7 model runs (saved `author/scre.html`, read with `../_kit/tools/html2txt.py`, 2026-10-30)

Observed:

- Run log 21:00–22:14: Kimi K3 attempts 1, 2 = 0.750, 0.750; Claude Opus 5.5 attempt 7 = 1.000; Qwen3.8 Max attempts 13–18 = 0.375, 0.125, 0.250, 0.250, 0.375, 0.000. Page summary: "Across 9 runs: 1 strict passes, mean reward 0.43". Qwen attempts all started 21:38:02; attempt 13 finished 22:08:52, attempt 18 at 22:10:10, attempt 14 at 22:14:12.
- The page shows the reviewed run's transcript (Qwen attempt 18) and other transcripts, but no verifier stdout/stderr or per-check results.
- Attempt 18: 24 steps, ran out of the 30 min working time (21 min reading docs before writing code). Final firmware = full rewrite at step 17 + patches at steps 20 and 23 (debug edits reverted). It builds; its own test gave `READY / ERR 4 / ERR 9 / ERR 4`.
- Its clock_init sets LDOPCTL 0x1B before clearing PWRDN2 (RCC2/USERCC2 path, XTAL 0xF→0xE, SYSDIV2 3, polls PLLLRIS) but never clears MOSCDIS: the RCC mask lacks bit 0 although the comment says it is cleared. Its sd_command dropped the starter's "≥ 8 clocks with CS low before each command" loop; QEMU's ssi-sd then swallows the next command byte, so CMD8's R7 read as 0xFF and ACMD41 never left idle. Its `for (d < 20000) (void)d;` delay is removed by -Os, so each `I` runs up to 2 × 100 000 CMD55/ACMD41 pairs (~3.6 M SPI frames).

Inference (no verifier output available):

- With drive.py f48a94a1 completing normally, attempt 18 would score ldo_errata_ok = 1 (and clock_ok, card_io_ok, id/ssi/oled/reinit = 0), i.e. ≥ 0.125, not 0.000. So drive.py most likely did not finish: it keeps every traced SPI frame (measured 181 B RAM, 92 B log, 13 µs parse per frame on the author PC with a synthetic trace, `author/mem_probe.py`; attempt 18's step-17 firmware text in `author/run-qwen-a18-firmware-step17.txt`) → several GB and minutes for ~10 M frames, above the 2 GiB / 300 s limits (OOM or test_outputs timeout → all checks fail). The 22:10 finish time fits a kill within a few minutes better than the 300 s timeout; which of the two: unknown.
- Effect: understates runaway-loop firmware (one failing run scored 0 instead of ~0.125–0.25). No false passes; the other 8 runs scored above 0, so their driver runs completed.
- Fairness note a reviewer may raise: attempt 18's SD sequence (0xFF after deselect, none before the next command) works on most real cards but not on QEMU's ssi-sd. The starter's loop and its comment cover this, and the model saw the failure in its own runs.

Correction package (local only, not uploaded, task locked): `corrections/verifier/drive.py` = f48a94a1 plus: per functional run 40 s budget, stop at 64 MiB of trace, evaluate ≤ 1 M trace lines (card_io_ok fails if cut), delete each trace and drop stored frames after evaluation; traced run 80 s (was 240 s); a timing-run timeout no longer fails rcgc_delay_ok by itself (UART0 and SSI0 must still have been reached). Host checks `python -I author/test_drive_local.py corrections/verifier/drive.py`: 0 failures; worst-case runtime estimate 256 s. Not run under QEMU; gold and naive_a must be re-verified through Verify before any re-upload.

Step texts (2026-10-30): the saved texts (Verify table, `author/screen-6c.html`) for `clock_ok` and `reinit_ok` say less than their checks, `oled_cs_ok` names one method, and `ssi_reconfig_ok` adds "re-enabled afterward", which it does not check. Earlier advice to keep them was wrong. Comparison and wording in `corrections/step-texts.md`; `corrections/scored-steps.json` is the matching steps file for the extension's Fill.

## Outstanding issues

- Inferences not yet confirmed: the grader's /tests/start.c and link.ld equal the /app/data copies (Verify builds and runs gold correctly, consistent with it); CPU=cortex-m3 in board.build.
- Open choices for the user: whether reviewers accept a multi-fault naive_a against the builder's "one mistake per answer" (brief requires < 0.3); whether to also put the starter through Verify as a baseline (optional, probe 4 already measured it).
- Done: 2.2 limits set as recommended (user statement); prompt re-pasted; Verify 2 clean.
- Saved prompt compared (`author/screen-4.3.html`): title "microSD bring-up on the EK-LM3S6965"; Context empty; `agent/PROMPT.md` "2147 characters" = local file without its final newline; all 19 non-blank lines identical.
- Section 7.1 (`author/screen-7.html`): "Default run — Optimised run: Kimi ×2 → Opus → Qwen ×6 on every task, then any model whose scores vary is topped up to 6 runs." Models: MoonshotAI Kimi K3, Anthropic Claude Opus 5.5, Qwen3.8 Max (0902), "in stages, up to 6 each", "2 to 18 runs, as the scores decide". No cost shown on 7.1; 7.2 Run / 7.3 Running not seen.
- 2026-10-30: `CLAUDE.md` moved to the parent folder (`../CLAUDE.md`, now with a shared-kit section); the template moved to `../_kit/TASK-NOTES.template.md`. Lessons from this task are in `../_kit/LESSONS.md`.
- Next action: wait for the reviewer. If changes are requested and editing reopens: upload `corrections/verifier/drive.py` to 5.4 (only if the reviewer's points do not change it), set the step texts from `corrections/step-texts.md` in the user's wording, run Verify, confirm gold 1.00 and naive_a 0.13, then compare the saved drive.py hash. No acceptance, score or payment is implied by the run results.

# Hashlist DOP builder: observed behaviour

What the task builder at dop.hashlist.com did while authoring `task-mvttqdbt` (folder `driver_peripheral`, 2026-10-29/30). The platform can change: treat each item as "last seen" on that date, and re-check it when a screen looks different. Evidence is in `driver_peripheral/TASK-NOTES.md` and the saved pages in `driver_peripheral/author/`.

## Getting builder screens to Claude

- Pasting a page's HTML truncates at about 50 000 characters (the editor CSS alone fills it). Instead, save the page from the browser as HTML into the task's `author/` folder and read it with `_kit/tools/html2txt.py`. It prints visible text plus input, textarea and select values and toggle states.
- Since 2026-10-30 the user also has DOP Builder Helper (`_kit/dop-builder-helper/`), a Chrome extension. It saves the live page as text, with no dialog, to a chosen folder or to Downloads. The text has the same markers as html2txt, plus an `open:` line and, on 5.4, a scored-steps table. Its live-page path is untested; see its README.
- Saved builder pages do not record the page address, so it is unknown whether builder URLs contain the task id.
- A saved HTML page keeps a code box's text (drive.py) in the textarea's `value` attribute, not as its content.
- An "Unsaved" label or a field that looks filled is not proof of saving. Compare saved pages or Try-the-box checksums with local files.

## Sections

1 Brief (1.1 What good looks like, 1.2 A worked example, 1.3 How a run works) · 2 Build settings (2.1 Shell, 2.2 Limits, 2.3 Internet, 2.4 Toolchain) · 3 Environment · 4 Prompt · 5 Golden set (5.1 Your steps, 5.2 Correct answer, 5.3 Common mistakes, 5.4 Scored steps) · 6 Verify · 7 Run.

The dashboard lists briefs with a price per accepted task and their requirements. Example: "Driver and Peripheral Bring-up", $300, with gold scoring 1.0, the naive answer under 0.3, and 3 models × 6 trials.

Dashboard as seen 2026-10-30 (user's screenshots):

- **Briefs.** Driver and Peripheral Bring-up, Hardware and Electrical Design, Control Logic and PLC Debugger, Real-Time Budget Planner and Sensor Configuration Faults. Each pays "$300 / successful submission, est. $67–94 / hour", with "6 trials · 3 models · Several submissions allowed". There is also "Custom rate: Hardware / PCB / Electrical".
- **"Your tasks."**
  - The bold line is the task title from section 4. It matched the saved prompt title, and an untitled draft shows its builder id (`task-…`).
  - The light line is the brief the task came from, or "your own".
  - Status is Draft or In review.

## 2 Build settings

- **2.1 Shell.** "Python" (default): the answer is `/app/answer.txt` with one `Label: value` per line. "Firmware on QEMU or Renode": the model writes the single file `/app/firmware.c`, and board files are generated in `/app/data` (`start.c`, `link.ld`, `uart.h`, `run.sh`, or `board.resc` on Renode). The grader is `verifier/drive.py` (author, hidden), driven by a generated `board.py` and `test_outputs.py`. Board list (default `lm3s6965evb`): netduinoplus2, stm32f4_discovery, netduino2, stm32vldiscovery, microbit, mps2/mps3, RA2E1/RA6M5, nucleo_f767zi, nucleo_wba52cg, AVR, SiFive E, OpenTitan.
- **Generated lm3s6965evb board files:** `start.c` copies .data, zeroes .bss and calls `app_main()`; its vector table holds only SP and reset, with no fault handlers. `link.ld` puts flash at 0x0 (256K) and RAM at 0x20000000 (64K). `uart.h` covers UART0 DR/FR only. `run.sh` = `qemu-system-arm -M lm3s6965evb -nographic -monitor none -chardev stdio,id=uart,mux=off,signal=off -serial chardev:uart -kernel "$1"`.
- **2.2 Limits.** Firmware-shell defaults: 2 CPU, 2 GiB, 8 GiB disk, 40 steps. Working time is fixed at 30 min. The grader-timeout select showed value 600, which is not one of its options (120/300/900/1800/3600), so set it explicitly. Used: 100 steps, 900 s. The models' prompts showed "N of 100 steps left · M of 30 minutes left".
- **2.3 Internet:** off. Every document, SDK and data file must be in the environment upload.
- **2.4 Toolchain.**
  - Mode "Describe it": a pinned `debian:12-slim` plus apt from snapshot.debian.org (20261006), with an editable package list. "My own Dockerfile" was not needed.
  - Used packages: `gcc-arm-none-eabi libnewlib-arm-none-eabi qemu-system-arm python3 git poppler-utils`. Resulting versions: gcc 12.2.1, newlib 3.3.0, QEMU 7.2.22, Python 3.11. No make or gdb.
  - The verifier image is separate: python:3.12-slim-bookworm plus the same apt packages, plus pytest. Verifier files go to `/tests`, and it creates `/app` and `/out`.
- **Try the box** builds the runtime image and runs 1–20 listed commands. It does not submit.
  - It runs as root, and the setup hook has already run.
  - One ~20 KB command stalled it in "running" for over an hour. Keep commands under ~7 KB and use `_kit/tools/make_probe.py` to ship private files inline.
  - Long results: save the page as HTML.

## 3 Environment

- Uploaded text files stay under `/app/data/…`. A PDF or other binary, or anything over 2 MB, lands in `/app/files/` instead. A folder upload did not keep the intended `data/docs/` path. Cite the paths the platform actually shows.
- **Hooks.** `hooks/setup.sh` ("before the model starts") runs as root in the workdir before the model's first step, and also for the correct answer and each common mistake. `hooks/teardown.sh` runs after the model's last step, before the answer file is read.
  - A failing setup is a run error. A failing teardown means no answer and a score of 0.
  - Files setup creates under the workdir are handed to the model's user. Other files stay root's, so `/app/data` is read-only to the model (inference).
  - Use setup to place the starter: `cp /app/data/starter/firmware.c /app/firmware.c`.
- Empty hook boxes show grey placeholder text (a Zephyr example). That placeholder is not saved content.

## 4 Prompt

- Fields: title, `agent/CONTEXT.md` (optional) and `agent/PROMPT.md`.
- Platform guidance: describe the problem and how often and when it happens. Leave out the cause, the answer, the method, and anything that hints at grading. Name the `/app/data` files the model needs.
- Verify checks that the files the prompt names exist in the box. Naming an output the model will create (`/app/build/firmware.elf`) was flagged. Word it as "build in /app/build … `-o firmware.elf`".

## 5 Golden set

- **5.1 Your steps:** free text, one step per line (`references/steps.md`). Plain sentences work. Numbering is optional.
- **5.2 Correct answer:** pre-filled answer path plus a textarea or upload for `references/gold.c`.
- **5.3 Common mistakes:** "A full answer with one common mistake in it. One mistake per answer." This conflicts with a brief that wants the naive answer under 0.3 when checks are independent. Here it was resolved with one wrong approach that causes several faults (a TM4C123-style bring-up).
- **5.4 Scored steps:**
  - Upload `verifier/drive.py`. "Generate checks" produces `verifier/test_outputs.py` from the steps; it says "Edits here are overwritten".
  - The generated test builds the answer and runs `python3 /tests/drive.py /tmp/built` with a **300 s timeout**. It reads stdout `metric=value` (the first value wins) and ignores stderr. Reward = passed steps / steps (weighted by Worth). Minimum 3 checks.
  - What the first "Generate checks" produced: 8 of 9 steps as "the judge reads it" (an LLM reading the answer), one field drive.py never prints, and one step that required the gold answer's exact guard.
  - Reset every step to: Checked by "value between", field, lowest, highest, Worth, and the per-mistake "gets it wrong" toggles.
  - Then inspect the saved table. Found once: a band of 1..0, a field with a trailing tab, and two step texts swapped.
  - `test_outputs.py` follows the table without another "Generate checks". The saved 5.4c page showed EXPECTED holding the user's edits.
  - Row markup (5.4c page):
    - aria-labels `Step N` (the text), `Step N: the field it reads`, `…: lowest accepted`, `…: highest accepted`, `…: points`, `…: one point more`/`less`, `Remove step N`;
    - "Checked by" is three buttons, and the chosen one has `data-on="true"`;
    - each mistake is a chip button with `title` and `aria-pressed`.
    - N is the displayed number. A "Prompt" row with no inputs once took number 1.
- **Where step texts go.**
  - The 5.1 page asks "How would a good engineer solve this problem, step by step? … They become your scored steps". That text is saved as `references/steps.md`.
  - "Generate checks" condenses each 5.1 line into a 5.4 step text and can drop parts. Here "the main oscillator … has to be turned on" and "so a newly inserted card works" were lost.
  - The 5.4 text goes into task.json's criteria and the test docstrings, and Verify's step table shows it. The results page seen during review showed neither text.
  - Neither text affects the score of a "value between" step. Only the field, the band, Worth and the mistake toggles do. A "the judge reads it" step would be graded from its text.
  - What reviewers open is not documented on any page seen.
- **Grader build command.** It is not shown in the builder. It was found in the public front-end bundle (`/assets/templates-*.js`, board.py template): `arm-none-eabi-gcc -mcpu=<CPU> -mthumb -Os -ffreestanding -fno-tree-loop-distribute-patterns -nostdlib -I/tests -T /tests/link.ld /tests/start.c <source> -lgcc -o <out>`, with a 180 s timeout. The output path `/tmp/built` may be a file or a folder, so the driver must accept both. Put the same command, with `/app/data` paths, in the prompt.

## 6 Verify

- Builds both images and checks the prompt's file names. Runs gold and each common mistake through the real grading route. Reports "gold reward 1.00 strict true", "naive_a reward 0.13 strict false", a step table, and "GRADER SOUND" when gold scores 1.0 and every mistake scores less.
- Takes about 2–3 min. It does not submit and can be repeated (no cost shown).
- It does not run the plain starter. Measure that in Try the box.

## 7 Run

- **Pressing Run submits the task for review** (screen 1.3), and the task then shows "In review".
- Sequence: "Optimised run: Kimi ×2 → Opus → Qwen ×6 on every task, then any model whose scores vary is topped up to 6 runs". Models: MoonshotAI Kimi K3, Claude Opus 5.5 and Qwen3.8 Max, with 2–18 runs. Observed: 9 runs over 74 min.
- **Results page:**
  - The reviewed run: model, reward, strict pass and steps.
  - Its transcript and other runs' transcripts. They are concatenated, and long heredocs are flattened to one line.
  - A run log with per-attempt rewards.
  - **No verifier stdout/stderr**, so a driver's stderr reasons cannot be seen there.
  - Save it as HTML into `author/`.
- Review status text: "With a reviewer. Somebody is reading it. Nothing is needed from you until they are done." Editing is assumed locked.

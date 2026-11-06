# Hashlist DOP builder: observed behaviour

What the task builder at dop.hashlist.com did while authoring `task-mvttqdbt` (folder `driver_peripheral`, 2026-10-29/30). The platform can change: treat each item as "last seen" on that date, and re-check it when a screen looks different. Evidence is in `driver_peripheral/TASK-NOTES.md` and the saved pages in `driver_peripheral/author/`.

## Getting builder screens to Claude

- Pasting a page's HTML truncates at about 50 000 characters (the editor CSS alone fills it). Instead, save the page from the browser as HTML into the task's `author/` folder and read it with `_kit/tools/html2txt.py`. It prints visible text plus input, textarea and select values and toggle states.
- Since 2026-10-30 the user also has DOP Builder Helper (`_kit/dop-builder-helper/`), a Chrome extension. It saves the live page as text, with no dialog, to a chosen folder or to Downloads. The text has the same markers as html2txt, plus `url:` and `open:` lines and, on 5.4, a scored-steps table. Saving live pages worked on 2026-10-30 (`realtime_budget`, 1.1–2.1).
- An HTML page saved from the browser does not record its address. The extension's capture does (2026-10-30, `realtime_budget`): builder URLs are `https://dop.hashlist.com/app/build/<uuid>/<page>`, and the uuid is not the `task-…` id. Page slugs seen: `separation` (1.1), `example` (1.2), `running` (1.3), `template` (2.1).
- A saved HTML page keeps a code box's text (drive.py) in the textarea's `value` attribute, not as its content.
- The extension's capture collapses runs of blank lines and trims line ends (`page.js`, line 79–80), also inside code boxes. Comparing a saved `drive.py` with the local file therefore needs the same collapsing; a plain comparison reports false differences (2026-11-03, `driver_peripheral`).
- An "Unsaved" label or a field that looks filled is not proof of saving. Compare saved pages or Try-the-box checksums with local files.

## Sections

1 Brief (1.1 What good looks like, 1.2 A worked example, 1.3 How a run works) · 2 Build settings (2.1 Shell, 2.2 Limits, 2.3 Internet, 2.4 Toolchain) · 3 Environment · 4 Prompt · 5 Golden set (5.1 Your steps, 5.2 Correct answer, 5.3 Common mistakes, 5.4 Scored steps) · 6 Verify · 7 Run.

The header's **"Ask"** button opens an AI chat assistant, not the reviewer. One question showed "$0.18" (2026-11-05, `realtime_budget`). Its answer about acceptance was generic: it named outside models (GPT-4o, o1, Claude 3 Sonnet) and called the brief's "1 to 4 of 10 runs" "guidance, not a gate". Don't treat its answers as the reviewer's rules.

The dashboard lists briefs with a price per accepted task and their requirements. Example: "Driver and Peripheral Bring-up", $300, with gold scoring 1.0, the naive answer under 0.3, and 3 models × 6 trials.

Dashboard as seen 2026-10-30 (user's screenshots):

- **Briefs.** Driver and Peripheral Bring-up, Hardware and Electrical Design, Control Logic and PLC Debugger, Real-Time Budget Planner and Sensor Configuration Faults. Each pays "$300 / successful submission, est. $67–94 / hour", with "6 trials · 3 models · Several submissions allowed". There is also "Custom rate: Hardware / PCB / Electrical".
- **"Your tasks."**
  - The bold line is the task title from section 4. It matched the saved prompt title, and an untitled draft shows its builder id (`task-…`).
  - The light line is the brief the task came from, or "your own".
  - Status is Draft or In review.

## 2 Build settings

- **2.1 shell list** (2026-10-30, `realtime_budget`): "Most popular" Python and C harness with budgets (Requires C). By domain: Software (Python, C harness with budgets); Firmware and automotive (Firmware on QEMU or Renode, Eclipse software); Hardware design (KiCad, KiCad · GUI, Blender, Blender · GUI, FreeCAD · GUI); Other (Desktop · GUI app). Python shell defaults: python:3.12-slim, 1 CPU, 1 GiB, 4 GiB disk, 40 steps, internet off, with "Use default settings" or "Edit settings".
- **C harness with budgets** (bundle id `constraintbench`, seen 2026-10-30, `realtime_budget`). The model writes `/app/solution.c`; the author writes `verifier/harness.c`, which calls the solution and prints `metric=value`; each scored step is a band on one metric.
  - The generated test builds `gcc -O2 -std=c11 -I/tests -o /tmp/prog /tests/harness.c /app/solution.c -lm` (180 s), runs `/tmp/prog` (300 s) and reads `metric=value` or `metric: value` from stdout, first value per label winning (`gencheck-*.js`). It adds a `test_it_builds` check.
  - The verifier image is python:3.12-slim-bookworm with `gcc libc6-dev` and pytest 9.1.1; `verifier/` is copied to `/tests`. Extra headers can go in `verifier/`. The builder says to give the model a copy under Environment and flags copies that differ.
  - 5.4 has two upload points: the harness, and "verifier/ Add a file" for headers. Pasting the harness does not add its header. A missing header made every answer score 0.00 in Verify. The summary said only "THE CORRECT ANSWER SCORES 0.000"; the gcc error was not shown in the log (2026-11-05, `realtime_budget/author/6.1-verify-20261105-190037.txt`).
  - Verify can list steps that the 5.4 page does not show: there were 3 old generated steps beside the 8 set by Fill. In that case the page was captured while it said "Saving". After the header was added and 5.4 showed "Saved", the next Verify listed only the 8 steps. Check that Verify's step count equals the 5.4 count (2026-11-05, `realtime_budget`).
  - Verify also scores two answers it makes from gold: `gold_in_other_notation` (n/a when no line reads `label: number`, as for a C file) and `empty_answer`, which should score 0 (2026-11-05, `realtime_budget/author/6.1-verify-20261105-194650.txt`).
  - Box defaults: `gcc@sha256:fa11eac6…`, 1 CPU, 2 GiB, 4 GiB disk, 40 steps, internet off. "Already here: C3-077 TEST-CRC" are built-in sample tasks.
  - That image (Try the box, 2026-10-30): Debian 12, gcc 13.4.0, Python 3.11.2, make, objdump and file; no gdb, pdftotext or pandas. The grader compiles with Debian's gcc 12.2. In the box, `nproc` and `free` report the host (64 CPUs, 773 GB), not the 2.2 limits.
- **Platform authoring guide** (in `index-*.js`, "Authoring a task, from the domain expert's side"): at most 20 steps; points on every step or none; reward = points met / all points; judged steps need two judges to agree and to quote at least three words from the answer file, so reasoning goes in the answer (a comment at the top of `solution.c`); `caught_by` marks which near miss must fail a step, and Verify calls the grader unsound if it does not.
- **RTL · terminal** (template id `rtl`, seen 2026-11-05, `HDL_mw32jhhu`). The 2.1 list now also has RTL · terminal and RTL · GUI under Hardware design.
  - Box: `debian:forky-20261005-slim` + `iverilog verilator g++ make python3`, 4 CPU, 8 GiB, 8 GiB disk, 300 steps, grader timeout 900 s, working time 3600 s.
  - References are Python scripts (`gold.py`, `naive_base.py`, `naive_a.py`) that write the design files. The grader `report.py` is generated, and `verifier/rtl.json` lists `module`, `dut`, `must` and the benches.
  - Try the box (2026-11-05 12:43, `HDL_mw32jhhu/author/2.4-toolchain-20261105-125804.txt`) showed Debian forky/sid, Icarus 13.0, Verilator 5.048, g++ 16.2.0, make 4.4.1 and Python 3.14.7. Commands run as root, `nproc` reports 4, and `/app` is empty before the uploads.
  - The template's default `rtl.json` (`"module": "design"`) and example `gold.py` (`module design`) use a reserved Verilog-2001 keyword. Icarus rejects it with "syntax error". Name the top module something else.
  - In 2.2 the step limit select was blank, because the template's 300 is not an option; working time showed "60 minutes · Set by the template", and grader timeout "15 minutes". The user set 500.
  - 3.1 Files (2026-11-05, `HDL_mw32jhhu/author/3.1-files-20261105-165940.txt`) offers "Upload files", "Upload a folder" and "New file"; "a .zip is unpacked in the box".
    - Uploading files puts them at `/app/data/<name>`. Uploading a folder `docs` puts its files at `/app/data/docs/…`, so the folder's own name is kept.
    - The setup and teardown hook boxes are on the same page.
    - The code preview on the saved page adds spaces between highlighted tokens (`` `timescale 1ns / 1ps ``), but the box held the exact files, as Try-the-box checksums confirmed.
  - 5.2 Correct answer (2026-11-05, `HDL_mw32jhhu/author/5.2-correct-answer-20261105-175926.txt`) has an **Answer** list: "what the grader gets: files, or folders ending in /". It defaults to the template's `/app/data/design.v`, so set it to the files in `rtl.json` `dut`, or every run scores 0.
    - The first entry is the "main answer", which the builder's checks and the judge read; "a run without it scores 0".
    - "Add a file or folder" adds further paths, which are only sent to the grader.
    - The page also shows tabs for the files gold.py writes.
  - Try the box after the uploads (2026-11-05 17:03, `author/2.4-toolchain-20261105-173550.txt`): files in `/app/data` are root-owned with mtime 1970. The setup hook had run (`chmod -R a+rwX /app/data` showed as 777/666), and `su nobody` could write there.
  - 1.2's example "result" panel calls gold minus the best mistake "separation" (1.00 − 0.67 = 0.33, "sound").
  - The full grader is in the public `templates-*.js`; it is extracted to `HDL_mw32jhhu/author/platform/report.py.from-bundle`. It does a regex lint of the dut files, elaborates the design alone with each bench's params, and runs each bench once on Icarus and 16 times on Verilator (`--x-initial unique`, `+verilator+rand+reset+2`). Every run gets `+nonce` and `+seed`. A check passes only if it passes on every run, and each run has a 300 s limit.
- **2.1 Shell.** "Python" (default): the answer is `/app/answer.txt` with one `Label: value` per line. "Firmware on QEMU or Renode": the model writes the single file `/app/firmware.c`, and board files are generated in `/app/data` (`start.c`, `link.ld`, `uart.h`, `run.sh`, or `board.resc` on Renode). The grader is `verifier/drive.py` (author, hidden), driven by a generated `board.py` and `test_outputs.py`. Board list (default `lm3s6965evb`): netduinoplus2, stm32f4_discovery, netduino2, stm32vldiscovery, microbit, mps2/mps3, RA2E1/RA6M5, nucleo_f767zi, nucleo_wba52cg, AVR, SiFive E, OpenTitan.
- **Generated lm3s6965evb board files:** `start.c` copies .data, zeroes .bss and calls `app_main()`; its vector table holds only SP and reset, with no fault handlers. `link.ld` puts flash at 0x0 (256K) and RAM at 0x20000000 (64K). `uart.h` covers UART0 DR/FR only. `run.sh` = `qemu-system-arm -M lm3s6965evb -nographic -monitor none -chardev stdio,id=uart,mux=off,signal=off -serial chardev:uart -kernel "$1"`.
- **2.2 Limits.** Firmware-shell defaults: 2 CPU, 2 GiB, 8 GiB disk, 40 steps. Working time is fixed at 30 min. The grader-timeout select showed value 600, which is not one of its options (120/300/900/1800/3600), so set it explicitly. Used: 100 steps, 900 s. On the C harness shell (2026-10-30, `realtime_budget`) the grader-timeout select was blank, and defaults were 1 core, 2 GiB, 4 GiB disk, 40 steps. The models' prompts showed "N of 100 steps left · M of 30 minutes left".
- **2.2 options** (`SectionFiles-*.js`, 2026-10-30): CPU 1/2/4, memory 1/2/4/8 GiB, disk 2/4/8/16 GiB, steps 10/20/40/60/100/200/500, grader timeout 2 min/5 min/15 min/30 min/1 hour.
- **2.3 Internet:** off. Every document, SDK and data file must be in the environment upload.
- **2.4 Toolchain.**
  - Mode "Describe it": a pinned `debian:12-slim` plus apt from snapshot.debian.org (20261006), with an editable package list. "My own Dockerfile" was not needed.
  - Used packages: `gcc-arm-none-eabi libnewlib-arm-none-eabi qemu-system-arm python3 git poppler-utils`. Resulting versions: gcc 12.2.1, newlib 3.3.0, QEMU 7.2.22, Python 3.11. No make or gdb.
  - The verifier image is separate: python:3.12-slim-bookworm plus the same apt packages, plus pytest. Verifier files go to `/tests`, and it creates `/app` and `/out`.
- **2.4 "Language" select** (C harness shell, 2026-10-30): options Python, C, C++, Rust, Go, Node. Picking one replaces the base image and packages with a tag image (C: `gcc:14-bookworm`, `build-essential, python3`), and the checker warns about an unpinned tag. It shows "Python" whenever the image is not one of those tags, as with the template's pinned gcc digest. To keep the digest, leave it alone and type the packages. "Template box, already checked" shows only while image and packages equal the template's.
- **Try the box** builds the runtime image and runs 1–20 listed commands. It does not submit.
  - It runs as root, and the setup hook has already run.
  - It looks for the answer in the box. A probe that unpacked gold to `/tmp/t` got status "Answer in the box" and "the model's box holds your answers (references/gold.c is at /tmp/t/gold.c)", though all commands ran (2026-11-03, `driver_peripheral`). Replacing the commands and running again returned the status to "Worked". Check the command box before Run, so it doesn't hold the answer.
  - One ~20 KB command stalled it in "running" for over an hour. Keep commands under ~7 KB and use `_kit/tools/make_probe.py` to ship private files inline.
  - Long results: save the page as HTML.

## 3 Environment

- Upload rules in the builder code (`SectionFiles-*.js`, `Uploader-*.js`, read 2026-10-30, `realtime_budget`):
  - A text file keeps its path relative to the chosen folder, and that path includes the folder's own name. Uploading `.../data/src` gives `/app/data/src/...`; uploading `.../environment/data` gives `/app/data/data/...`.
  - A file counts as text if it is UTF-8 without NUL and at most 2 000 000 bytes. Anything else goes flat to `/app/files/<name>`, and a `.zip` is unpacked into `/app/files/<name>/`.
  - Limits are 500 files per upload and 50 MB per file. Uploading a PDF adds `poppler-utils` to the packages if it is missing.
- Uploaded text files stay under `/app/data/…`. A PDF or other binary, or anything over 2 MB, lands in `/app/files/` instead. A folder upload did not keep the intended `data/docs/` path. Cite the paths the platform actually shows.
- **Hooks.** `hooks/setup.sh` ("before the model starts") runs as root in the workdir before the model's first step, and also for the correct answer and each common mistake. `hooks/teardown.sh` runs after the model's last step, before the answer file is read.
  - A failing setup is a run error. A failing teardown means no answer and a score of 0.
  - Files setup creates under the workdir are handed to the model's user. Other files stay root's, so `/app/data` is read-only to the model (inference).
  - Use setup to place the starter: `cp /app/data/starter/firmware.c /app/firmware.c`.
- **3.1 "Use one of my environments"** (2026-10-30, `realtime_budget`): offers "Use one you built" or "Build a new one". Picking a saved environment (here the EK-LM3S6965 one) asks "Replace and copy". Confirming it also replaces the build settings, here C harness → Firmware on QEMU. Press Cancel unless that is wanted. The brief says a saved environment appears under My environments and can hold several tasks.
- After the uploads (C harness shell, 2026-10-30), the generated Dockerfile gained `COPY environment/data /app/data`.
  - In Try the box, `/app/data` is root 755 with files 644. PDFs are in `/app/files`, read-only (444).
  - The setup hook had already run. Its `/app/solution.c` showed as root 644 there; the hand-over to the model's user is not visible in Try the box.
- Empty hook boxes show grey placeholder text (a Zephyr example). That placeholder is not saved content.

## 4 Prompt

- Fields: title, `agent/CONTEXT.md` (optional) and `agent/PROMPT.md`.
- Platform guidance: describe the problem and how often and when it happens. Leave out the cause, the answer, the method, and anything that hints at grading. Name the `/app/data` files the model needs.
- Verify checks that the files the prompt names exist in the box. Naming an output the model will create (`/app/build/firmware.elf`) was flagged. Word it as "build in /app/build … `-o firmware.elf`".
- That wording later got flagged too. On 2026-11-03 (`driver_peripheral`, `author/6.1-verify-20261103-153054.txt`) Verify said "The prompt names /app/build, but the agent box has nothing there … If the model is meant to create it, ignore this", though the same sentence passed on 2026-10-29 and Try the box shows the setup hook creating the empty folder. So either the check changed, or it runs before the hook or counts an empty folder as nothing; which one is unknown. Scores are not affected. Naming it relatively (`cd /app`, `mkdir -p build && cd build`) cleared the warning in the next Verify.

## 5 Golden set

- **5.1 Your steps:** free text, one step per line (`references/steps.md`). Plain sentences work. Numbering is optional. The page says "Hidden from the model" and shows "references/steps.md written" once saved (2026-11-03, `driver_peripheral`). Its button is "Continue"; whether that regenerates 5.4 is not yet seen, so move on with the section list.
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
  - What reviewers open is not documented on any page seen. They do see per-check results for each run: the reviewer of `driver_peripheral` reported which check all six strongest runs lost and what the firmware did (message, 2026-11-05).
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
- **Decision page** (seen 2026-11-02, `driver_peripheral/author/hashlist-data-operations-platform-20261102-200609.txt`): URL `/app/review/<id>`. It shows the title with "Fail", a "Fix it" button, "Sent back", the reviewer's summary, a numbered "What to change" list, the reviewed run, "Across 9 runs: 1 strict passes, mean reward 0.43", and then the transcripts and run log. Saved as text it is 2.9 MB.
- **Builder after "Sent back"** (2026-11-03, `driver_peripheral`, `author/4.3-prompt-20261103-123133.txt`): "Fix it" opens the builder at 4.3 and keeps what is saved (user report). Section 4.3 had already taken a new prompt without it, showing "Saved". The builder URL uses the same uuid as the review page, with page slug `brief-text`. Whether Run needs anything further is not yet seen.
- The same page states: "A task is accepted only when the strongest model fails most of at least 6 runs." Check each brief's own rule too.
  - In the first `driver_peripheral` run the default sequence gave Opus one run, and it scored 1.00.
  - The rework's review reports six runs of the strongest model (2026-11-05). Inference: the "scores vary" top-up gave them, so a strongest model that passes its first run may get no more. No run page was saved for this revision, so how the runs started is not confirmed.
- **Acceptance** (`driver_peripheral`, reviewer's message pasted by the user, 2026-11-05; accepted page not seen):
  - The reviewer's message says why the task was accepted, how each model failed, and any grader issue.
  - Reviewers can correct a grader defect in their own scoring and still accept. Don't rely on this: the same message asks for the fix in future tasks.

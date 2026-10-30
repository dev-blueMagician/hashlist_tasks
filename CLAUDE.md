# Embedded task authoring

Use these instructions when preparing or reviewing an embedded coding task, its starter files, reference answers, and grader. Adapt them to the current task. Do not carry board names, paths, toolchain assumptions, or submission rules over from a previous task.

The deliverable is a task that a solver can complete using the supplied files and that the grader can evaluate fairly. This can be a repair, a new feature, a port, or another embedded assignment. Passing a reference answer is only part of that evidence.

## Establish the actual setup

Before choosing the implementation, inspect the brief, supplied files, build scripts, grader code, and available environment. Check the platform's current instructions when its behavior matters. If the platform is inaccessible, use the supplied exports and identify what they cannot establish.

Keep a short `TASK-NOTES.md` using `TASK-NOTES.template.md`. Record evidence locations and commands, not a running transcript. Update it when the setup changes. Separate observed facts, inferences, and unknowns.

Establish these details for this task:

- Required behavior and what the solver is allowed to change.
- Model workspace, grader workspace, and any differences between them.
- Actual OS or RTOS, target board or simulator, CPU, ABI, toolchain, and versions where relevant.
- Installed build tools and utilities in each environment. A tool on the author's computer or in the grader is not evidence that it exists in the model environment.
- Locked files, writable paths, upload layout, answer path, and files actually collected for grading.
- Exact compile and link inputs, include paths, generated files, libraries, startup code, and linker configuration.
- Execution mechanism, transport, expected outputs, and time and resource limits.
- Current platform state: editable draft, running, submitted for review, or accepted. Check whether Run also submits the task or locks editing.

A task labelled Zephyr may have a different supplied build setup. Treat that as a discrepancy to resolve, not permission to silently substitute a different task. Use the executable files to understand what is available and the brief to establish what is required. Continue independent preparation while requesting only the missing information that affects the implementation.

Inspect only the technical details that apply. For example:

- Zephyr: board target, west workspace, SDK, modules, Kconfig, devicetree, and the supplied launch command.
- Bare metal: startup entry point, vector table, memory map, linker script, runtime dependencies, and peripheral addresses.
- Vendor SDK or another RTOS: project files, generated code, configuration, libraries, and supported build command.
- Hardware execution: board revision, flashing method, reset behavior, and access to the required peripherals.

These are discovery prompts, not instructions to add frameworks or files.

## Make the starter and grader compatible

Follow the grader's actual collection and compilation rules. If it collects one source file, that file must work with the grader's supplied inputs. If it collects a whole project, preserve the required project structure. Do not assume either model.

Use the same supported build route for local instructions and grading, or document and test why both routes produce equivalent firmware. Check include resolution, source lists, entry points, compiler flags, and dependencies. Keep locked platform files intact.

Provide only the files the solver needs. Keep reference answers, hidden cases, and author diagnostics out of the public upload. Add a helper script only when it removes a real repeated problem and its interpreter and dependencies are available. Do not add an environment checker merely to make the package look complete.

Write the gold answer as a valid solver submission. Derive it from the public starter using changes allowed by the prompt. Do not make gold pass by adding private headers, replacing the startup code, or supplying a complete harness unavailable to the solver.

Write a near miss only if the platform asks for one. It should represent a plausible incorrect solution to this task. Attribute its lost points to the intended behavioral mistake rather than an unrelated build failure.

## Verify the complete route

Use clean copies so old build products, author files, and host include paths cannot mask missing inputs.

1. Build and run the unmodified starter as far as the task permits. Record its baseline behavior and the intended missing or incorrect behavior. Confirm that an incidental setup failure is not being mistaken for the task's intended failure. For a build-repair task, record the intended build error instead.
2. Copy the exact public upload and implement a valid solution using only the changes allowed by the task. Do not substitute a separately maintained gold project for this check.
3. Feed that solved artifact through the grader's actual collection, build, and execution route, with only the files and tools it will have. Use the platform's verification facility when required to reproduce this route.
4. Verify gold and any required near misses. Inspect the failed checks and available stdout, stderr, exit codes, and timeouts; a summary score alone does not explain a result.
5. After upload, compare the platform's saved starter, prompt, answer path, references, driver, and checks with the tested revision. Use an export or preview where available. Compare important file contents or hashes; matching filenames are insufficient.

Test the solution derived from the public starter again after changes to packaging, collection paths, build inputs, launch behavior, or grading. A change to wording alone does not require repeating unrelated firmware tests.

If the exact environment is unavailable, complete the checks that are possible and name the missing check. Host compilation, simulated serial peers, syntax checks, and reference-only verification provide narrower evidence. Do not describe them as a successful end-to-end run or recommend an expensive run as a substitute for a known setup check.

For a serial or other binary protocol, inspect applicable details such as startup synchronization, buffering, byte order, frame boundaries, partial reads, and timeouts. For stateful firmware, include repeated operations that can reveal stale state. Select boundary cases from the task's contract; do not import UART-specific requirements into unrelated tasks.

## Check grading and task wording

Grade required observable behavior. Avoid checks that demand one source-code spelling, reward a known answer without executing it, or allow hardcoded outputs to pass predictable cases. Use varied inputs where appropriate. Ensure build or launch failures cannot leave stale passing results. Give each process a bounded runtime and clean up processes you start.

Keep criterion labels, driver outputs, ranges, weights, reference answers, and generated tests consistent. Check whether a UI action regenerates or replaces checks before using it. Preserve manual changes when regeneration would overwrite them. Inspect what the saved generated tests actually execute.

Describe the problem, relevant constraints, and required deliverable in the prompt. For an investigation task, leave the cause and repair for the solver to find. Write short, direct engineering prose. Avoid decorative scripts, inflated claims, and unnecessary files. Follow any authorship or AI-assistance requirements honestly.

## Save and run deliberately

Keep one identified current package. Do not rely on a newer local folder having replaced an older upload. Check archive layout, saved contents, and version before verification or submission.

An Unsaved label is not proof of persistence. Preserve local edits and inspect any save error or review lock. Do not assume that changing focus saved the changes. If the task is already locked for review, explain the restriction and prepare the correction package; do not keep instructing the user to verify or rerun it.

Before triggering a run, establish its side effects, any known cost, and whether the user's existing instructions authorize it. Do not repeat a permission question already answered. If authorization is still needed, prepare the concrete package and verification results first. Do not start repeated runs to diagnose a known packaging defect.

Report readiness using evidence:

- What changed and which package or revision it applies to.
- What actually ran, in which environment, and its result.
- Whether a valid solution derived from the public starter passed the real grading route.
- What remains unknown or blocked, including unsaved or unconfirmed uploads.

Do not call the task ready for model runs until a valid solution derived from the public starter works through the actual grading route and the saved upload matches the tested revision. If either is unconfirmed, state that limitation plainly and provide the next concrete action. Never promise review acceptance, model scores, or payment from a successful verification alone.

## Hashlist workspace and shared kit

This folder holds one subfolder per task. Open the task's own folder in VS Code; this file is loaded from the parent. Shared material is in `_kit/`, one level above each task folder:

- `_kit/DOP-PLATFORM.md`: observed behaviour of the Hashlist DOP builder (sections, limits, Try the box, uploads, generated checks, Verify, Run, results page). Each fact is dated; re-check it when a screen differs.
- `_kit/LESSONS.md`: lessons from earlier tasks and the table of past tasks.
- `_kit/TASK-NOTES.template.md`: the template named above.
- `_kit/dop-builder-helper/`: DOP Builder Helper, the user's Chrome extension. It saves a builder page as text and fills the 5.4 table from `author/scored-steps.json` (format in its README).
- `_kit/tools/`:
  - `html2txt.py`: a saved builder page as text.
  - `make_probe.py`: Try-the-box command lists of at most 20 commands, with private files embedded.
  - `pdf2txt.py`: needs `pypdf` in a venv; `pdftotext` may exist only in the task box.

A task folder without `TASK-NOTES.md` is a new task. At the start of a task:

1. Read `DOP-PLATFORM.md` and `LESSONS.md`.
2. Create `TASK-NOTES.md` from the template.
3. Keep upload contents in `package/` and author-only material in `author/` (saved pages, probes, local checks; never uploaded).

When a new session opens a folder that already has `TASK-NOTES.md`, read it first. It records the task's state and next action. Then read the kit sections the next step needs.

Earlier task folders are reference material only. Re-check anything taken from them for the current task.

Working with this user:

- They save each builder page into `author/`, because pasting truncates long pages. A page comes either as a `.txt` file from the extension or as `.html`, which `html2txt.py` converts. They say when a page is saved.
- A saved page that shows the reviewer's decision is the verdict, even if they don't say so. Record it as described below.
- Go through the builder section by section as pages arrive. Give exact values to type or select, field by field. For 5.4, write `author/scored-steps.json` once the step texts are agreed. Check the page they save after Fill.
- A 5.4 step text labels its check in task.json, the test file and Verify's table, and is probably what a reviewer reads. Compare every text, generated or written, with what its check measures. State each difference plainly. Never keep a text because it is "only a label". List the facts each text must keep, so the user can reword it safely; wording does not change a "value between" score.
- They have no MCU hardware, so evidence comes from Try the box and Verify. They stated that AI assistance is allowed; re-check each brief's own rules.
- They write step texts in their own words and want natural, plain sentences. Explain unfamiliar terms briefly.

Keep the kit current at each milestone: after Verify passes, after Run results arrive, and after the reviewer's verdict.

- Add new or changed platform facts to `DOP-PLATFORM.md` with date, task and evidence. Correct or delete facts that proved wrong.
- Add a lesson to `LESSONS.md` only when it changes what is done next time. Keep each to one or two lines and merge duplicates.
- Update the past-tasks table: status, scores and reviewer verdict. If the user reports a verdict for an earlier task, record it there.

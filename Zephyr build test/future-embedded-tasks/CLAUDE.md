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

# Scored steps for task-mvr8934a

Section 5.4 uses the platform's firmware build and `board()` helper. Upload
`verifier/drive.py` in the harness field. It receives the compiled ELF as its
argument, sends UART batches through `board(elf, data, expected)`, and prints
one numeric `metric=value` line per check.

Add the eight steps below. Choose **Range** for each, with lower and upper
bounds both set to **1**. Use the label exactly as written. Tick `naive_a` only
for the four rows marked Yes.

| Statement | Label | Points | naive_a gets it wrong |
| --- | --- | ---: | --- |
| Firmware builds with the supplied startup and linker script. | `build` | 2 | No |
| Firmware reaches the UART ready message. | `boot` | 1 | No |
| Each request gets one complete response. | `completion` | 1 | No |
| All queued values are counted. | `counts` | 3 | Yes |
| The uint32 sum includes every queued value. | `sums` | 3 | Yes |
| The checksum follows FIFO order. | `fifo_order` | 3 | Yes |
| No queued values remain after processing. | `drained` | 3 | Yes |
| Completed batches return success, including empty batches. | `return_codes` | 1 | No |

The UI writes `verifier/test_outputs.py` from these entries. Do not use Judge
checks or replace the platform's `board.py`. The platform already compiles
the answer before running the driver. The driver reports `build=1` once that
compiled image has been passed to it.

## Replace the earlier partial answers

The platform compiles **one answer source file**, together with its own
`start.c`, `link.ld` and `uart.h`. It does not link an extra task `app.c` or
copy task headers into the verifier. The earlier function-only answers were
therefore incomplete for this interface.

The current starter, gold and near miss each contain the complete firmware,
including `app_main()`. Only the drain implementation differs. Replace the
earlier uploads as follows:

| Section | Current file |
| --- | --- |
| 3.1 | `task/firmware/pipeline.c`, `task/build.sh` |
| 4.2 Context | `agent/CONTEXT.md` |
| 4.3 Prompt | `agent/PROMPT.md` |
| 5.1 Your steps | `references/steps.md` |
| 5.2 Correct answer | `references/gold.c` |
| 5.3 Common mistake | `references/naive_a.c` |
| 5.4 Harness | `verifier/drive.py` |

Keep the Answer file field at `/app/data/task/firmware/pipeline.c`. Remove the
old task `app.c`, `pipeline.h`, `queue.h` and `build.py`; they are no longer needed. Leave
the four locked environment files unchanged. Preserve existing platform canary
comments when replacing the prompt. Keep all reference and verifier files
hidden from the model.

The common mistake is a counted loop that compares against a shrinking queue
count. It returns replies but stops before draining the queue. Expected scores
are gold 1.0 and near miss 5/17 (~0.294). The supplied Verify log confirms these
scores for the references. That check did not exercise the old starter files
which remained in the model's environment.

## Files ready for upload

Use `dist/locked-firmware-v7/`. It contains the two environment files in
`03-environment-task-files.zip`, the prompt and context, the complete reference
answers, steps, criteria, and `06-drive.py`. The JSON criteria are a record of
the entries above; enter the rows in the UI unless it offers an import option.
Older archives are superseded. The environment ZIP already has a `task/` prefix.

The public build command remains:

```sh
sh /app/data/task/build.sh
```

The model-run log confirms that the runtime has ARM GCC, QEMU, and a shell,
but no Python. The build script therefore uses only the shell and compiler.
Python is used by the separate verifier image, where it is installed.

No compiler or QEMU is installed on this workstation. Local tests cover the
driver API, UART parsing, scoring, packaging and process handling using simulated
outputs. Real ARM compilation and UART execution still need the platform's
**Verify** step. **Run also submits the task for review.**

For local checks and packaging, from the workspace root:

```sh
python -m unittest discover -s authoring/tests -v
python authoring/tools/package.py --output dist/locked-firmware-v7
```

The earlier standalone `grade.py` remains a local diagnostic utility; it is
not the Section 5.4 upload. This revision follows the supplied bare-metal board
interface. The original brief's Zephyr/`west` requirement remains unverified.

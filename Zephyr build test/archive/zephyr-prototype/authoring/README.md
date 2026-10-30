# Zephyr internal build test

This package repairs a queue-draining implementation and checks it with real
Zephyr builds and QEMU execution in the supplied, unchanged environment.
No runtime downloads or Python third-party dependencies are needed.

## Files and visibility

| Path | Purpose | Visible to model? |
| --- | --- | --- |
| `agent/PROMPT.md` | Task instructions | Yes |
| `zephyr_smoke/` | Buildable application with a deliberate drain bug | Yes |
| `references/gold.c`, `gold.py` | Correct implementation and installer | No |
| `references/naive_a.c`, `naive_a.py` | Buildable near miss and installer | No |
| `verifier/` | Trusted build inputs, test cases, grader and report code | No |
| `criteria.json` | Eight scoring criteria | No |
| `tools/validate.py` | Author-only reference validation | No |
| `tools/package.py` | Offline packaging with explicit agent file allowlist | No |

The local directory is an **authoring package**, not an agent filesystem image.
Do not upload this entire workspace as model-visible task data. Stage only the
five application files under `/app/data/task/zephyr_smoke` and provide the prompt
separately. Private grader code, references, scratch directories, logs and
reports must be outside the model's mounts and readable paths. Folder names
and ZIP separation alone do not provide this isolation; the platform must.

## 1. Import into the existing task

Use the pre-created Zephyr environment selected by the internal brief. Keep its
build configuration, image, installed modules and tools unchanged. Do not add
Dockerfiles or run `west update` or package installation.

The platform's generated task manifest and grader interface were not supplied.
There is deliberately no speculative `task.json`. Map this package into the
existing scaffold and use its actual schema. Confirm these integration fields:

- Application path: `/app/data/task/zephyr_smoke` after staging agent files.
- Primary artifact: `task/zephyr_smoke/src/pipeline.c` relative to `/app/data`,
  or its platform-specific equivalent. It starts present, so a no-op attempt is
  graded as the incorrect starter, not as a missing submission.
- Export: at least that source file; the grader reads `src/pipeline.c` below
  the application path supplied through `--app`.
- Network: disabled. Target: `qemu_cortex_m3`.
- Grader command and report path: use the platform's private entry point and
  output mount; adapt the standalone JSON output if its interface differs.
- Criteria: copy the entries in `criteria.json` using the existing schema.
  No model-judged steps are needed.
- Budget: allow two fresh builds plus two bounded QEMU runs per grade. Defaults
  are 600 seconds per build and 30 per run; align with the existing task limit.

Retain the two **actual platform-generated canary comments** at the top of its
prompt. The two comments in this package are placeholders, not registered DOP
canaries; replace them with those existing lines when importing the prompt.

## 2. Build and inspect the public starter

In a shell already configured by the supplied image:

```sh
west build -b qemu_cortex_m3 -d /app/data/task/build-local /app/data/task/zephyr_smoke
west build -d /app/data/task/build-local -t run
```

Use a new build-directory name for a subsequent clean build. Expect the example
case to consume five of six values with one remaining; the empty case is zero.
The public example is intentionally wrong. Exit interactive QEMU with Ctrl+A, X.
No physical board or peripheral is needed.

## 3. Run the hidden grader

Example paths below are placeholders for **private platform mounts**, not paths
to add to the agent's task data:

```sh
python3 /private/task/verifier/grade.py \
  --app /app/data/task/zephyr_smoke \
  --report /private/results/attempt-001.json \
  --work-dir /private/scratch/attempt-001 \
  --west-cwd "$ZEPHYR_BASE"
```

Both report path and scratch directory must be new. If `ZEPHYR_BASE` is unset,
pass the actual configured Zephyr workspace directory. The grader always builds
in fresh directories. It uses trusted CMake, configuration, header and main
files plus a snapshot of submitted `pipeline.c`; submitted build scripts and
binaries are not executed on the grader host.

First it builds and runs the trusted correct implementation to establish that
the toolchain, board, harness and emulator work. If that probe fails, it exits
nonzero without creating a score report. Then it builds the candidate and runs
the six cases. Runtime is bounded, and west/build/QEMU process groups are
terminated after the end marker, timeout or excessive output. Returning from
Zephyr's `main` is not used as the QEMU exit mechanism. Stop-after-marker is a
test completion boundary; behavior scheduled after that boundary is not tested.

The weights total 17: build 2; boot 1; complete report 1; counts 3; sums 3;
FIFO checksum 3; empty queue 3; return codes 1. Each behavior check must pass
every case. Expected gold reward is 1.0. Expected near-miss reward is 5/17,
approximately 0.2941, with the four substantive behavior checks failing.
These are expectations until real-image validation is run.

The output has `reward`, `strict_pass`, `failure_category`, `counters` and
`info`. `info.checks` names every scored check; `info.failed` lists failures;
`info.skipped` identifies checks not reached. A validly graded wrong answer
exits zero. Harness/setup failure exits nonzero and writes no report. Partial
scores are diagnostic and do not imply a working full solution.

## 4. Validate both references in the real image

Keep the authoring kit private. From its directory, run:

```sh
python3 tools/validate.py \
  --output /private/validation/zephyr-smoke-001 \
  --west-cwd "$ZEPHYR_BASE"
```

This copies the starter into separate private submissions, installs each
reference, and runs both through the actual grader. It requires gold 1.0,
near miss below 0.3, and failure of all four criteria designated `caught_by`.
Logs and JSON reports remain under the output directory. It never patches the
public starter. Then run the platform's own Proof/Verify with the same mappings.
Do not claim image compatibility until both checks succeed.

## 5. Check locally and package

On this Windows workstation, from the workspace root:

```powershell
python -m unittest discover -s task/tests -v
python task/tools/package.py --output dist/zephyr-smoke
```

Local tests exercise parsing, scoring, process termination, report handling,
reference installation and packaging. Simulated tool calls are explicitly
control-flow tests; they do not compile Zephyr or emulate its kernel.

`agent.zip` contains only the prompt and application. Extracting its `task/`
directory into `/app/data` gives the documented app path. Supply
`agent/PROMPT.md` through the platform's prompt field, not as a replacement for
its generated canary lines. `verifier-private.zip` and `references-private.zip`
are separate author/grader uploads. `contents.json` lists files and hashes.

## Documentation consulted

- [Zephyr message queues](https://docs.zephyrproject.org/latest/kernel/services/data_passing/message_queues.html)
- [QEMU Cortex-M3 board](https://docs.zephyrproject.org/latest/boards/qemu/cortex_m3/doc/index.html)

These document the APIs and board workflow. The brief is the source for the
claimed image versions; no matching local image was available during authoring.

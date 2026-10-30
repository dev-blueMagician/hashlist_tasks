"""Build and run a submitted source file inside the existing Zephyr image.

This is a standalone grader entry point, not a guessed DOP manifest adapter.
The host platform must keep this directory inaccessible to the model.
"""
import argparse
import json
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import sys
import time

from report import CASES, END, WEIGHTS, evaluate_runtime, make_report

HERE = Path(__file__).resolve().parent
MAX_LOG = 2 * 1024 * 1024
MAX_SOURCE = 128 * 1024


class HarnessError(RuntimeError):
    pass


def stop_tree(proc):
    if os.name == "nt":
        subprocess.run(["taskkill", "/PID", str(proc.pid), "/T", "/F"],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
    else:
        try:
            os.killpg(proc.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        try:
            proc.wait(timeout=2)
        except subprocess.TimeoutExpired:
            pass
        # Kill the entire process group even if west has already exited.
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired as exc:
        raise HarnessError("Could not stop the build/emulator process tree") from exc


def run_command(command, *, cwd, log, timeout, completion=None):
    """Bound process time/output; terminate west, build tools and QEMU together."""
    kwargs = {"start_new_session": True} if os.name != "nt" else {}
    start = time.monotonic()
    reason = None
    matched_at = None
    with log.open("wb") as stream:
        try:
            proc = subprocess.Popen(command, cwd=cwd, stdout=stream,
                                    stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL,
                                    **kwargs)
        except OSError as exc:
            raise HarnessError(f"Cannot start {command[0]}: {exc}") from exc
        try:
            while proc.poll() is None:
                elapsed = time.monotonic() - start
                data = log.read_bytes()
                if len(data) > MAX_LOG:
                    reason = "output_limit"
                    break
                # Give serial output a brief grace period so a second report or
                # fatal error directly after the marker is also captured.
                if completion and re.search(
                        rb"(?m)^" + re.escape(completion.encode()) + rb"\r?$", data):
                    if matched_at is None:
                        matched_at = time.monotonic()
                    if time.monotonic() - matched_at >= 0.15:
                        reason = "completed"
                        break
                if elapsed >= timeout:
                    reason = "timeout"
                    break
                time.sleep(0.02)
        finally:
            # This also catches orphan QEMU children if the launcher exited.
            stop_tree(proc)
    data = log.read_bytes()
    if len(data) > MAX_LOG:
        reason = "output_limit"
    output = data[:MAX_LOG].decode("utf-8", errors="replace")
    if reason is None:
        reason = "exited"
    return {"reason": reason, "returncode": proc.returncode, "output": output}


def write_harness(app):
    shutil.copytree(HERE / "harness", app)
    arrays = []
    calls = []
    for name, values in CASES.items():
        literals = ", ".join(f"{value}U" for value in values) or "0U"
        arrays.append(f"static const uint32_t {name}[] = {{{literals}}};")
        calls.append(f'    if (run_case("{name}", {name}, {len(values)}U) != 0) return 1;')
    main = (HERE / "main.c.in").read_text(encoding="utf-8")
    main = main.replace("/* CASE_ARRAYS */", "\n".join(arrays))
    main = main.replace("/* CASE_CALLS */", "\n".join(calls))
    (app / "src" / "main.c").write_text(main, encoding="utf-8")


def build_and_run(app, build, *, args, prefix):
    build_result = run_command(
        [args.west, "build", "-b", "qemu_cortex_m3", "-d", str(build), "-o=-j2", str(app)],
        cwd=args.west_cwd, log=args.work_dir / f"{prefix}-build.log",
        timeout=args.build_timeout)
    if build_result["reason"] != "exited" or build_result["returncode"] != 0:
        return build_result, None
    elf = build / "zephyr" / "zephyr.elf"
    if not elf.is_file() or elf.stat().st_size == 0:
        raise HarnessError("west reported success but produced no zephyr/zephyr.elf")
    run_result = run_command(
        [args.west, "build", "-d", str(build), "-o=-j2", "-t", "run"],
        cwd=args.west_cwd, log=args.work_dir / f"{prefix}-run.log",
        timeout=args.run_timeout, completion=END)
    return build_result, run_result


def runtime_checks(run):
    checks, records = evaluate_runtime(run["output"])
    if run["reason"] in ("timeout", "output_limit") or (
            run["reason"] == "exited" and run["returncode"] != 0):
        checks = {name: (passed if name == "boot" else False)
                  for name, passed in checks.items()}
    return checks, records


def grade(args):
    source = args.app / "src" / "pipeline.c"
    if not source.is_file():
        return make_report({}, "no_submission", details={"missing": str(source)}, skipped=WEIGHTS)
    if source.is_symlink() or source.stat().st_size > MAX_SOURCE:
        return make_report({}, "tampering", details={"error": "source must be a regular file <=128 KiB"}, skipped=WEIGHTS)
    # Snapshot only the permitted source before any build. Never execute
    # submitted CMake, Kconfig, scripts, or binaries on the grader host.
    candidate = source.read_bytes()
    if not shutil.which(args.west):
        raise HarnessError("west is unavailable; run this grader in the configured Zephyr image")
    if not args.west_cwd.is_dir():
        raise HarnessError("--west-cwd is not a directory")
    args.work_dir.mkdir(parents=True, exist_ok=False)

    # First establish that this exact toolchain, board, QEMU and trusted
    # harness work. Infrastructure failure must not become a model score.
    probe_app = args.work_dir / "probe-app"
    write_harness(probe_app)
    shutil.copyfile(HERE / "probe.c", probe_app / "src" / "pipeline.c")
    built, run = build_and_run(probe_app, args.work_dir / "probe-build", args=args, prefix="probe")
    if run is None:
        raise HarnessError("Trusted environment probe did not build; inspect probe-build.log")
    probe_checks, _ = runtime_checks(run)
    if not all(probe_checks.values()):
        raise HarnessError("Trusted environment probe did not pass; inspect probe-run.log")

    app = args.work_dir / "candidate-app"
    write_harness(app)
    (app / "src" / "pipeline.c").write_bytes(candidate)
    built, run = build_and_run(app, args.work_dir / "candidate-build", args=args, prefix="candidate")
    details = {"board": "qemu_cortex_m3", "environment_probe": "passed",
               "build_reason": built["reason"], "build_returncode": built["returncode"],
               "logs": str(args.work_dir)}
    if run is None:
        return make_report({"build": False}, "build_failed", details=details,
                           skipped=[name for name in WEIGHTS if name != "build"])
    checks, records = runtime_checks(run)
    checks["build"] = True
    details.update({"run_reason": run["reason"], "run_returncode": run["returncode"], "cases": records})
    category = "wrong_answer" if checks["completion"] else "tests_failed"
    return make_report(checks, category, details=details)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--app", type=Path, default=Path("/app/data/task/zephyr_smoke"))
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--work-dir", type=Path, required=True, help="New private scratch directory")
    parser.add_argument("--west", default="west")
    parser.add_argument("--west-cwd", type=Path, default=Path(os.environ.get("ZEPHYR_BASE", os.getcwd())))
    parser.add_argument("--build-timeout", type=float, default=600)
    parser.add_argument("--run-timeout", type=float, default=30)
    args = parser.parse_args()
    if args.build_timeout <= 0 or args.run_timeout <= 0:
        parser.error("timeouts must be positive")
    for name in ("app", "report", "work_dir", "west_cwd"):
        setattr(args, name, getattr(args, name).resolve())
    if args.report.exists() or args.work_dir.exists():
        parser.error("report and work directory must be new paths")
    if args.work_dir.is_relative_to(args.app) or args.report.is_relative_to(args.app):
        parser.error("report and private work directory must be outside the submitted app")
    try:
        result = grade(args)
        args.report.parent.mkdir(parents=True, exist_ok=True)
        # Exclusive creation avoids overwriting a prior result.
        with args.report.open("x", encoding="utf-8") as stream:
            json.dump(result, stream, indent=2)
            stream.write("\n")
    except (HarnessError, OSError, ValueError) as exc:
        print(f"HARNESS_ERROR: {exc}", file=sys.stderr)
        return 2
    print(json.dumps({"reward": result["reward"], "strict_pass": result["strict_pass"],
                      "report": str(args.report)}))
    return 0


if __name__ == "__main__":
    sys.exit(main())


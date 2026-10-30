"""Grade Cortex-M3 firmware using the actual locked startup/linker/launcher."""
import argparse
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import time

from build_support import compile_command, find_compiler
from report import BANNER, CASES, FRAME, WEIGHTS, evaluate_uart, make_report, requests

HERE = Path(__file__).resolve().parent
MAX_LOG = 1024 * 1024
MAX_SOURCE = 128 * 1024
LOCKED_FILES = ("start.c", "link.ld", "uart.h", "run.sh")


class HarnessError(RuntimeError):
    pass


def stop_tree(proc):
    if os.name == "nt":
        subprocess.run(["taskkill", "/PID", str(proc.pid), "/T", "/F"], check=False,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    else:
        try:
            os.killpg(proc.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        try:
            proc.wait(timeout=1)
        except subprocess.TimeoutExpired:
            pass
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired as exc:
        raise HarnessError("Could not stop compiler/emulator process tree") from exc


def run_process(command, *, cwd, stdout_path, stderr_path, timeout, payload=None):
    """Use binary pipes/files, wait for the UART handshake, and bound execution."""
    kwargs = {"start_new_session": True} if os.name != "nt" else {}
    reason = "exited"
    sent = False
    completed_at = None
    start = time.monotonic()
    with stdout_path.open("wb") as stdout, stderr_path.open("wb") as stderr:
        try:
            proc = subprocess.Popen(command, cwd=cwd, stdout=stdout, stderr=stderr,
                                    stdin=subprocess.PIPE if payload is not None else subprocess.DEVNULL,
                                    **kwargs)
        except OSError as exc:
            raise HarnessError(f"Cannot launch {command[0]}: {exc}") from exc
        try:
            while proc.poll() is None:
                output = stdout_path.read_bytes()
                if len(output) > MAX_LOG or stderr_path.stat().st_size > MAX_LOG:
                    reason = "output_limit"
                    break
                if payload is not None:
                    if not sent and output.startswith(BANNER):
                        try:
                            proc.stdin.write(payload)
                            proc.stdin.flush()
                        except (BrokenPipeError, OSError):
                            reason = "io_failed"
                            break
                        sent = True
                    if sent and len(output) >= len(BANNER) + FRAME.size * len(CASES):
                        if completed_at is None:
                            completed_at = time.monotonic()
                        if time.monotonic() - completed_at >= 0.1:
                            reason = "completed"
                            break
                if time.monotonic() - start >= timeout:
                    reason = "timeout"
                    break
                time.sleep(0.01)
        finally:
            stop_tree(proc)
            if proc.stdin is not None:
                try:
                    proc.stdin.close()
                except OSError:
                    pass
    output = stdout_path.read_bytes()
    if len(output) > MAX_LOG or stderr_path.stat().st_size > MAX_LOG:
        reason = "output_limit"
    return {"reason": reason, "returncode": proc.returncode,
            "output": output[:MAX_LOG], "sent": sent}


def build_and_run(source, args, prefix):
    app = args.work_dir / (prefix + "-app")
    app.mkdir()
    (app / "pipeline.c").write_bytes(source)
    elf = args.work_dir / (prefix + ".elf")
    built = run_process(
        compile_command(args.cc, args.data_root, app, elf), cwd=args.work_dir,
        stdout_path=args.work_dir / (prefix + "-build.stdout"),
        stderr_path=args.work_dir / (prefix + "-build.stderr"), timeout=args.build_timeout)
    if built["reason"] != "exited" or built["returncode"] != 0:
        return built, None
    if not elf.is_file() or elf.read_bytes()[:4] != b"\x7fELF":
        raise HarnessError("Compiler reported success without producing an ELF file")
    run = run_process(
        [args.shell, str(args.data_root / "run.sh"), str(elf)], cwd=args.work_dir,
        stdout_path=args.work_dir / (prefix + "-uart.bin"),
        stderr_path=args.work_dir / (prefix + "-qemu.stderr"),
        timeout=args.run_timeout, payload=requests())
    return built, run


def runtime_checks(run):
    checks, records = evaluate_uart(run["output"])
    if run["reason"] != "completed" or not run["sent"]:
        checks = {name: (passed if name == "boot" else False) for name, passed in checks.items()}
    return checks, records


def grade(args):
    source = args.task_dir / "firmware/pipeline.c"
    if not source.is_file():
        return make_report({}, "no_submission", details={"missing": str(source)}, skipped=WEIGHTS)
    if source.is_symlink() or source.stat().st_size > MAX_SOURCE:
        return make_report({}, "tampering", details={"error": "source must be a regular file <=128 KiB"}, skipped=WEIGHTS)
    candidate = source.read_bytes()
    for name in LOCKED_FILES:
        if not (args.data_root / name).is_file():
            raise HarnessError(f"Missing locked input: {args.data_root / name}")
    args.cc = find_compiler(args.cc)
    if not args.cc or not shutil.which(args.shell) or not shutil.which("qemu-system-arm"):
        raise HarnessError("Installed ARM GCC, sh and qemu-system-arm are required; no tools were installed")
    args.work_dir.mkdir(parents=True, exist_ok=False)
    _, probe = build_and_run((HERE / "probe.c").read_bytes(), args, "probe")
    if probe is None:
        raise HarnessError("Trusted baseline failed to compile with locked inputs; inspect probe-build logs")
    checks, _ = runtime_checks(probe)
    if not all(checks.values()):
        raise HarnessError("Trusted baseline failed on the locked launcher; inspect probe UART/QEMU logs")
    built, run = build_and_run(candidate, args, "candidate")
    details = {"machine": "lm3s6965evb", "entry_point": "app_main",
               "environment_probe": "passed", "build_reason": built["reason"],
               "build_returncode": built["returncode"], "logs": str(args.work_dir)}
    if run is None:
        return make_report({"build": False}, "build_failed", details=details,
                           skipped=[name for name in WEIGHTS if name != "build"])
    checks, records = runtime_checks(run)
    checks["build"] = True
    details.update({"run_reason": run["reason"], "run_returncode": run["returncode"], "cases": records})
    return make_report(checks, "wrong_answer" if checks["completion"] else "tests_failed", details=details)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--task-dir", type=Path, default=Path("/app/data/task"))
    parser.add_argument("--data-root", type=Path, default=Path("/app/data"))
    parser.add_argument("--work-dir", type=Path, required=True, help="New private scratch directory")
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--cc", help="Installed ARM GCC executable")
    parser.add_argument("--shell", default="sh")
    parser.add_argument("--build-timeout", type=float, default=60)
    parser.add_argument("--run-timeout", type=float, default=10)
    args = parser.parse_args()
    if args.build_timeout <= 0 or args.run_timeout <= 0:
        parser.error("timeouts must be positive")
    for name in ("task_dir", "data_root", "work_dir", "report"):
        setattr(args, name, getattr(args, name).resolve())
    if args.work_dir.exists() or args.report.exists():
        parser.error("work directory and report must be new paths")
    if args.work_dir.is_relative_to(args.task_dir) or args.report.is_relative_to(args.task_dir):
        parser.error("grader output paths must be outside model-visible task files")
    try:
        result = grade(args)
        args.report.parent.mkdir(parents=True, exist_ok=True)
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

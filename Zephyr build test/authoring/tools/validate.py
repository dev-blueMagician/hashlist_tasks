"""Validate both real references using installed ARM GCC and the locked QEMU launcher."""
import argparse
import json
from pathlib import Path
import shutil
import subprocess
import sys

AUTHOR = Path(__file__).resolve().parents[1]
PUBLIC = AUTHOR.parent / "task"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True, help="New private output directory")
    parser.add_argument("--data-root", type=Path, default=Path("/app/data"))
    parser.add_argument("--cc")
    args = parser.parse_args()
    output = args.output.resolve()
    if output.exists():
        parser.error("output must be new")
    output.mkdir(parents=True)
    reports = {}
    for name in ("gold", "naive_a"):
        task = output / name / "task"
        shutil.copytree(PUBLIC, task, ignore=shutil.ignore_patterns("build", "__pycache__", "*.pyc"))
        shutil.copyfile(AUTHOR / "references" / f"{name}.c", task / "firmware/pipeline.c")
        report = output / name / "report.json"
        command = [sys.executable, str(AUTHOR / "verifier/grade.py"),
                   "--task-dir", str(task), "--data-root", str(args.data_root.resolve()),
                   "--work-dir", str(output / name / "work"), "--report", str(report)]
        if args.cc:
            command += ["--cc", args.cc]
        status = subprocess.run(command, check=False)
        if status.returncode != 0:
            print(f"VALIDATION_NOT_COMPLETE: {name} could not be graded; no compatibility claim.", file=sys.stderr)
            return 2
        reports[name] = json.loads(report.read_text(encoding="utf-8"))
    passed = (reports["gold"]["reward"] == 1.0 and reports["gold"]["strict_pass"]
              and 0 < reports["naive_a"]["reward"] < 0.3
              and all(not reports["naive_a"]["info"]["checks"][name]
                      for name in ("counts", "sums", "fifo_order", "drained")))
    summary = {"passed": passed, "gold_reward": reports["gold"]["reward"],
               "naive_reward": reports["naive_a"]["reward"],
               "validation": "ARM GCC plus locked run.sh and QEMU"}
    (output / "summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary))
    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main())


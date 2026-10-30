"""Run both references through the real grader in the supplied Zephyr shell."""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

TASK = Path(__file__).resolve().parents[1]
PUBLIC_APP = TASK.parent / "task" / "zephyr_smoke"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path, help="New private validation directory")
    parser.add_argument("--west-cwd", type=Path, default=Path(os.environ.get("ZEPHYR_BASE", os.getcwd())))
    parser.add_argument("--west", default="west")
    parser.add_argument("--build-timeout", type=float, default=600)
    parser.add_argument("--run-timeout", type=float, default=30)
    args = parser.parse_args()
    output = args.output.resolve()
    if output.exists():
        parser.error("--output must be a new directory")
    if not shutil.which(args.west):
        print("VALIDATION_NOT_RUN: west is unavailable; use the pre-created Zephyr environment.", file=sys.stderr)
        return 2
    output.mkdir(parents=True)
    reports = {}
    for variant in ("gold", "naive_a"):
        app = output / variant / "app"
        shutil.copytree(PUBLIC_APP, app)
        shutil.copyfile(TASK / "references" / f"{variant}.c", app / "src" / "pipeline.c")
        report = output / variant / "report.json"
        command = [sys.executable, str(TASK / "verifier" / "grade.py"),
                   "--app", str(app), "--report", str(report),
                   "--work-dir", str(output / variant / "work"),
                   "--west", args.west, "--west-cwd", str(args.west_cwd.resolve()),
                   "--build-timeout", str(args.build_timeout), "--run-timeout", str(args.run_timeout)]
        status = subprocess.run(command, check=False)
        if status.returncode != 0:
            print(f"VALIDATION_NOT_COMPLETE: {variant} grader exited {status.returncode}", file=sys.stderr)
            return 2
        reports[variant] = json.loads(report.read_text(encoding="utf-8"))
    gold = reports["gold"]
    naive = reports["naive_a"]
    separating = (gold["reward"] == 1.0 and gold["strict_pass"]
                  and 0 < naive["reward"] < 0.3 and not naive["strict_pass"]
                  and all(not naive["info"]["checks"][name]
                          for name in ("counts", "sums", "fifo_order", "drained")))
    summary = {"passed": bool(separating), "gold_reward": gold["reward"],
               "naive_reward": naive["reward"], "board": "qemu_cortex_m3",
               "validation": "real west builds and QEMU runs"}
    (output / "summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary))
    return 0 if separating else 1


if __name__ == "__main__":
    sys.exit(main())


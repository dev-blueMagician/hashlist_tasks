"""Install the correct implementation into an explicitly selected task copy."""
import argparse
from pathlib import Path
import shutil

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--task-dir", type=Path, required=True)
    args = parser.parse_args()
    target = args.task_dir / "firmware/pipeline.c"
    if not target.is_file():
        parser.error("task copy must contain firmware/pipeline.c")
    shutil.copyfile(Path(__file__).with_name("gold.c"), target)


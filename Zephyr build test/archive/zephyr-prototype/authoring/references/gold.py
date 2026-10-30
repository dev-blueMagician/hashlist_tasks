"""Install the correct source into an explicitly selected submission app."""
import argparse
from pathlib import Path
import shutil


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--app", required=True, type=Path)
    args = parser.parse_args()
    target = args.app / "src" / "pipeline.c"
    if not target.is_file():
        parser.error("--app must contain src/pipeline.c; no files were changed")
    shutil.copyfile(Path(__file__).with_name("gold.c"), target)


if __name__ == "__main__":
    main()


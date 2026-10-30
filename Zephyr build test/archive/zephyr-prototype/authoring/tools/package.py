"""Create separate agent, verifier, and author-only reference ZIP files offline."""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile

TASK = Path(__file__).resolve().parents[1]
PUBLIC_TASK = TASK.parent / "task"
APP_FILES = ("CMakeLists.txt", "prj.conf", "src/pipeline.h", "src/pipeline.c", "src/main.c")


def write_zip(destination, paths):
    with zipfile.ZipFile(destination, "x", compression=zipfile.ZIP_DEFLATED) as archive:
        for source, target in sorted(paths, key=lambda item: item[1]):
            info = zipfile.ZipInfo(target, date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, source.read_bytes())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path, help="New output directory")
    args = parser.parse_args()
    output = args.output.resolve()
    if output.exists():
        parser.error("--output must be new; existing files are never overwritten")
    # Section 3.1 accepts only task/ files. Prompt, tests and references belong
    # to different sections and must never be bundled into this upload.
    agent = [(PUBLIC_TASK / "zephyr_smoke" / name, f"task/zephyr_smoke/{name}") for name in APP_FILES]
    agent.append((PUBLIC_TASK / "check_environment.py", "task/check_environment.py"))
    private = [(path, path.relative_to(TASK).as_posix())
               for path in (TASK / "verifier").rglob("*")
               if path.is_file() and "__pycache__" not in path.parts and path.suffix != ".pyc"]
    private.append((TASK / "criteria.json", "criteria.json"))
    references = [(path, path.relative_to(TASK).as_posix())
                  for path in (TASK / "references").iterdir()
                  if path.is_file() and path.suffix in (".py", ".c")]
    groups = {"environment-task-files.zip": agent, "verifier-private.zip": private,
              "references-private.zip": references}
    for paths in groups.values():
        for source, _ in paths:
            if not source.is_file() or source.is_symlink():
                parser.error(f"missing or symlinked input: {source}")
    output.mkdir(parents=True)
    manifest = {}
    for name, paths in groups.items():
        archive = output / name
        write_zip(archive, paths)
        manifest[name] = {"sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
                          "files": [target for _, target in paths]}
    (output / "prompt.txt").write_bytes((TASK / "agent" / "PROMPT.md").read_bytes())
    (output / "contents.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Created separate agent/private archives in {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


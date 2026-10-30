"""Package the Section 3.1 text files separately from all private material."""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile

AUTHOR = Path(__file__).resolve().parents[1]
PUBLIC = AUTHOR.parent / "task"
PUBLIC_FILES = ("build.sh", "firmware/pipeline.c")


def write_zip(path, files):
    with zipfile.ZipFile(path, "x", compression=zipfile.ZIP_DEFLATED) as archive:
        for source, destination in sorted(files, key=lambda item: item[1]):
            info = zipfile.ZipInfo(destination, (2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, source.read_bytes())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True, help="New directory")
    args = parser.parse_args()
    output = args.output.resolve()
    if output.exists():
        parser.error("output must be new; nothing was overwritten")
    groups = {
        "03-environment-task-files.zip": [(PUBLIC / name, "task/" + name) for name in PUBLIC_FILES],
        "private-verifier.zip": [(AUTHOR / "verifier/drive.py", "verifier/drive.py")],
        "private-references.zip": [(p, p.relative_to(AUTHOR).as_posix())
                                   for p in (AUTHOR / "references").iterdir()
                                   if p.is_file() and p.suffix in (".c", ".py", ".md", ".txt")],
    }
    copies = {"04-title.txt": AUTHOR / "agent/TITLE.txt", "04-context.txt": AUTHOR / "agent/CONTEXT.md",
              "04-prompt.txt": AUTHOR / "agent/PROMPT.md", "05-gold.c": AUTHOR / "references/gold.c",
              "05-naive_a.c": AUTHOR / "references/naive_a.c", "05-criteria.json": AUTHOR / "criteria.json",
              "05-steps.txt": AUTHOR / "references/steps.md", "05-naive_a-note.txt": AUTHOR / "references/naive_a.txt",
              "06-drive.py": AUTHOR / "verifier/drive.py"}
    all_sources = [source for files in groups.values() for source, _ in files] + list(copies.values())
    if any(not path.is_file() or path.is_symlink() for path in all_sources):
        parser.error("a package input is missing or symlinked")
    output.mkdir(parents=True)
    manifest = {}
    for name, files in groups.items():
        write_zip(output / name, files)
        manifest[name] = {"sha256": hashlib.sha256((output / name).read_bytes()).hexdigest(),
                          "files": [destination for _, destination in files]}
    for name, source in copies.items():
        (output / name).write_bytes(source.read_bytes())
        manifest[name] = {"sha256": hashlib.sha256(source.read_bytes()).hexdigest()}
    (output / "contents.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Created platform-section files in {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


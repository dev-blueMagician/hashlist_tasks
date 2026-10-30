"""Build this task against the existing locked Cortex-M3 startup and linker."""
import argparse
import os
from pathlib import Path
import shutil
import subprocess
import sys


def find_compiler(explicit=None):
    if explicit:
        return shutil.which(explicit)
    for name in ("arm-none-eabi-gcc", "arm-zephyr-eabi-gcc"):
        compiler = shutil.which(name)
        if compiler:
            return compiler
    sdk = os.environ.get("ZEPHYR_SDK_INSTALL_DIR")
    if sdk:
        compiler = Path(sdk) / "arm-zephyr-eabi/bin/arm-zephyr-eabi-gcc"
        if compiler.is_file():
            return str(compiler)
    return None


def compile_command(compiler, data_root, firmware, output):
    return [compiler, "-mcpu=cortex-m3", "-mthumb", "-std=c11", "-Os",
            "-Wall", "-Wextra", "-Werror", "-ffreestanding", "-fno-builtin",
            "-fno-unwind-tables", "-fno-asynchronous-unwind-tables",
            "-nostdlib", "-nostartfiles", "-Wl,--build-id=none",
            "-T", str(data_root / "link.ld"), "-I", str(data_root),
            "-I", str(firmware), str(data_root / "start.c"),
            str(firmware / "pipeline.c"), "-lgcc",
            "-o", str(output)]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    task = Path(__file__).resolve().parent
    parser.add_argument("--data-root", type=Path, default=task.parent)
    parser.add_argument("--output", type=Path, default=task / "build/firmware.elf")
    parser.add_argument("--cc", help="Installed ARM GCC executable; no downloads")
    args = parser.parse_args()
    compiler = find_compiler(args.cc)
    if not compiler:
        parser.error("No installed ARM GCC found. Inspect the supplied environment; do not install tools.")
    data = args.data_root.resolve()
    for name in ("start.c", "link.ld", "uart.h"):
        if not (data / name).is_file():
            parser.error(f"Missing locked input: {data / name}")
    output = args.output.resolve()
    if output.exists():
        parser.error("--output must be new; use another task-local filename")
    if not output.is_relative_to(task):
        parser.error("--output must stay inside the task directory")
    output.parent.mkdir(parents=True, exist_ok=True)
    status = subprocess.run(compile_command(compiler, data, task / "firmware", output),
                            timeout=60, check=False)
    if status.returncode == 0:
        print(f"Built {output}")
        print(f"Run with the supplied launcher: sh {data / 'run.sh'} {output}")
    return status.returncode


if __name__ == "__main__":
    sys.exit(main())


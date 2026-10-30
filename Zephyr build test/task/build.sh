#!/bin/sh
set -eu

task_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
data_dir=$(dirname -- "$task_dir")
mkdir -p "$task_dir/build"

arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -Os -ffreestanding \
    -fno-tree-loop-distribute-patterns -nostdlib \
    -I "$data_dir" -T "$data_dir/link.ld" \
    "$data_dir/start.c" "$task_dir/firmware/pipeline.c" \
    -lgcc -o "$task_dir/build/firmware.elf"

printf 'Built %s\n' "$task_dir/build/firmware.elf"

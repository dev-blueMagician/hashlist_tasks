#!/bin/sh
# sh run-sd.sh firmware.elf card.img [v1]
# The board with a microSD card in the slot, UART0 on stdin/stdout (as run.sh).
# The image size must be a power of two: up to 2 GiB is a standard-capacity
# card (SDSC), larger is high capacity (SDHC). Sparse files are fine:
#   truncate -s 64M sdsc.img; truncate -s 4G sdhc.img
# A third argument "v1" makes the card an SD version 1.x card.
#
# QEMU resets RCC to 0x078E3AC0, the silicon to 0x078E3AD1 (datasheet, RCC
# register). The CPU starts in a 24-byte shim at 0x2000FF00 that writes the
# documented value and jumps to the reset vector:
#   ldr r0,=0x400FE060; ldr r1,=0x078E3AD1; str r1,[r0]; movs r0,#4; ldr r0,[r0]; bx r0
elf=$1
img=$2
ver=
[ "${3:-}" = v1 ] && ver="-global sd-card.spec_version=1"
shim=${TMPDIR:-/tmp}/lm3s6965-rcc-shim.bin
printf '\003\110\004\111\001\140\004\040\000\150\000\107\000\277\000\277\140\340\017\100\321\072\216\007' \
    > "$shim.$$" && mv "$shim.$$" "$shim"
exec qemu-system-arm -M lm3s6965evb -nographic -monitor none \
    -chardev stdio,id=uart,mux=off,signal=off -serial chardev:uart \
    -device loader,file="$shim",addr=0x2000FF00,force-raw=on \
    -device loader,addr=0x2000FF01,cpu-num=0 \
    -drive if=sd,format=raw,file="$img" $ver -kernel "$elf"

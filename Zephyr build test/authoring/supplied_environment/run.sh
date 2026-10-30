#!/bin/sh
# sh run.sh firmware.elf: the board, with its UART on stdin/stdout. mux=off so
# that a 0x01 byte on the wire is data and not a QEMU escape.
exec qemu-system-arm -M lm3s6965evb -nographic -monitor none \
    -chardev stdio,id=uart,mux=off,signal=off -serial chardev:uart -kernel "$1"

#!/bin/sh
# Put the current firmware source where the engineer works on it.
set -eu
[ -e /app/firmware.c ] || cp /app/data/starter/firmware.c /app/firmware.c
mkdir -p /app/build

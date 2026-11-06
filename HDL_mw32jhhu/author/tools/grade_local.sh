#!/bin/bash
# Grade a design folder (pktbuf.v, pktbuf_egress.v) with the platform's own
# report.py, laid out as in the grader: <root>/tests and <root>/app/data.
#   grade_local.sh <design_dir> <label>
# Writes <scratch>/grade/<label>/out/reward.json and prints it.
set -e
H=/c/Users/a/Documents/Github/Eddy/Hashlist/HDL_mw32jhhu
DES=$(cd "$1" && pwd); LABEL=$2
S=${GRADE_ROOT:-/c/Users/a/AppData/Local/Temp/claude/18ff48a3c28c8945/e6a5d3f1-3a1a-4d95-adeb-6ff610c17914/scratchpad/grade}
R="$S/$LABEL"
rm -rf "$R"; mkdir -p "$R/tests" "$R/app/data" "$R/out"
cp -r "${VERIFIER:-$H/package/verifier}/." "$R/tests/"
cp "$H/author/platform/report.py.from-bundle" "$R/tests/report.py"
cp -r "$H/package/environment/data/." "$R/app/data/"
cp "$DES"/pktbuf.v "$DES"/pktbuf_egress.v "$R/app/data/"
M=/c/msys64/usr/bin
# MAKEFLAGS: host-only fix for MSYS2 g++ 16 failing to link Verilator's -Os build
"$M/env" MSYSTEM=UCRT64 MAKEFLAGS="OPT_FAST=-O2 OPT_GLOBAL=-O2" "$M/bash" -lc "cd '$R' && /usr/bin/python3 tests/report.py '$R' > out/stdout.txt 2> out/stderr.txt; echo exit=\$?"
cat "$R/out/reward.json"

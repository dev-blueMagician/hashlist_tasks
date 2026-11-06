#!/bin/bash
# Grade a design folder (the four txsched files) with the platform's own
# report.py, laid out as in the grader: <root>/tests and <root>/app/data.
#   grade_local.sh <design_dir> <label>
set -e
A=/c/Users/a/Documents/Github/Eddy/Hashlist/HDL_mw3o014d_Trung/author
DES=$(cd "$1" && pwd); LABEL=$2
S=${GRADE_ROOT:-/c/Users/a/AppData/Local/Temp/claude/97ba5d7eb9f7cee3/02445966-7bb7-43fd-afa0-92b16a1d20c6/scratchpad/grade}
R="$S/$LABEL"
rm -rf "$R"; mkdir -p "$R/tests" "$R/app/data" "$R/out"
cp "$A/bench/rtl.json" "$A/bench/tb_txsched.v" "$R/tests/"
cp "$A/platform/report.py.from-bundle" "$R/tests/report.py"
cp "$DES"/txsched.v "$DES"/txsched_timebase.v "$DES"/txsched_fifo.v "$DES"/txsched_rr.v "$R/app/data/"
M=/c/msys64/usr/bin
# MAKEFLAGS: host-only fix for MSYS2 g++ 16 failing to link Verilator's -Os build
"$M/env" MSYSTEM=UCRT64 MAKEFLAGS="OPT_FAST=-O2 OPT_GLOBAL=-O2" "$M/bash" -lc "cd '$R' && /usr/bin/python3 tests/report.py '$R' > out/stdout.txt 2> out/stderr.txt; echo exit=\$?"
/c/Users/a/AppData/Local/Programs/Python/Python314/python.exe -c "
import json,sys; d=json.load(open(sys.argv[1])); print(sys.argv[2], 'reward', d['reward'], 'failed', d['info']['failed']); [print('   ', k, ':', v[:160]) for k,v in d['info']['missed'].items()]" "$R/out/reward.json" "$LABEL"

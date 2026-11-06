#!/bin/bash
# usage: run_vl.sh <design> <nseeds> <params...>   Verilator with the grader's flags, power-up seeds 1..n
d=$1; n=$2; shift 2; G=""; for kv in "$@"; do G="$G -G$kv"; done
tag=$(echo "$d $*" | tr -c 'A-Za-z0-9' _)
M=/c/msys64/usr/bin
"$M/env" MSYSTEM=UCRT64 MAKEFLAGS="OPT_FAST=-O2 OPT_GLOBAL=-O2" "$M/bash" -lc "cd '$(pwd)' && mkdir -p /tmp/vl/$tag && verilator --binary --timing -j 4 -Wno-fatal -Wno-lint -Wno-style --timescale 1ns/1ps --x-initial unique --x-assign unique --top-module tb_txsched -Mdir /tmp/vl/$tag -o vsim $G rtl/$d/txsched.v rtl/$d/txsched_timebase.v rtl/$d/txsched_fifo.v rtl/$d/txsched_rr.v bench/tb_txsched.v > /tmp/vl/$tag/build.log 2>&1 || { tail -30 /tmp/vl/$tag/build.log; exit 1; }; for s in \$(seq 1 $n); do /tmp/vl/$tag/vsim +verilator+seed+\$s +verilator+rand+reset+2 +nonce=abcd +seed=\$((s*7919)) | tr -d '\000' | grep -E 'CHECK' | grep -v PASS | sed \"s/^/seed \$s: /\"; done; echo done-$d"

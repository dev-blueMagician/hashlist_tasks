#!/bin/bash
# usage: tools_run.sh <design> <seed> <params...>   (Icarus, quick)
d=$1; sd=$2; shift 2; P=""; for kv in "$@"; do P="$P -Ptb_txsched.$kv"; done
M=/c/msys64/usr/bin
"$M/env" MSYSTEM=UCRT64 "$M/bash" -lc "cd '$(pwd)' && mkdir -p /tmp/tx && iverilog -g2012 -o /tmp/tx/$d.vvp -s tb_txsched $P rtl/$d/txsched.v rtl/$d/txsched_timebase.v rtl/$d/txsched_fifo.v rtl/$d/txsched_rr.v bench/tb_txsched.v 2>&1 | head -20 && vvp -n /tmp/tx/$d.vvp +nonce=abcd +seed=$sd | tr -d '\000' | grep -E 'CHECK|stats|DONE' | sed 's/CHECK 000000000000abcd //'"

"""Write author/rtl/naive_*/ from author/rtl/gold/: each variant is gold with one
plausible mistake. Run: py -I make_variants.py"""
import os
import shutil

HERE = os.path.dirname(os.path.abspath(__file__))
RTL = os.path.join(HERE, "..", "rtl")
FILES = ["txsched.v", "txsched_timebase.v", "txsched_fifo.v", "txsched_rr.v"]


def read(f):
    return open(os.path.join(RTL, "gold", f), encoding="utf-8").read()


def sub(src, old, new, count=1):
    assert src.count(old) == count, (old, src.count(old))
    return src.replace(old, new)


GOLD_DUE = """            wire [TS_W-1:0] d    = now_next - h_lt;
            wire            due  = !d[TS_W-1];
            wire            late = due && (d >= LATE_WIN);
"""

VARIANTS = {}

# a: the shortcut: plain unsigned comparisons, as if the counter never wrapped;
# the earliest launch time is the smallest one.
top = read("txsched.v")
top = sub(top, GOLD_DUE, """            wire [TS_W-1:0] d    = now_next - h_lt;
            wire            due  = (now_next >= h_lt);
            wire            late = due && (d >= LATE_WIN);
""")
top = sub(top, "            assign lag[g*TS_W +: TS_W] = d;\n", "            assign lag[g*TS_W +: TS_W] = ~h_lt;     // smallest launch time first\n")
VARIANTS["naive_a"] = {"txsched.v": top}

# b: partial: wrap handled, but decisions use now, the counter in the cycle of
# the take, not the cycle the frame appears in.
top = read("txsched.v")
top = sub(top, "            wire [TS_W-1:0] d    = now_next - h_lt;\n", "            wire [TS_W-1:0] d    = now - h_lt;\n")
VARIANTS["naive_b"] = {"txsched.v": top}

# c: earliest-first compares raw launch times; due and late are right.
top = read("txsched.v")
top = sub(top, "            assign lag[g*TS_W +: TS_W] = d;\n", "            assign lag[g*TS_W +: TS_W] = ~h_lt;     // smallest launch time first\n")
VARIANTS["naive_c"] = {"txsched.v": top}

# d: late frames are dropped only when the output stage could take a frame.
top = read("txsched.v")
top = sub(top, "            assign drop[g]  = !pause && !q_empty[g] && h_sc && late;\n",
          "            assign drop[g]  = !pause && stage_free && !q_empty[g] && h_sc && late;\n")
top = sub(top, "    wire stage_free = !out_valid || out_ready;\n", "")
top = sub(top, "    wire [NCH-1:0]      q_empty;\n", "    wire stage_free = !out_valid || out_ready;\n    wire [NCH-1:0]      q_empty;\n")
VARIANTS["naive_d"] = {"txsched.v": top}

# e: no class priority: due scheduled frames and best-effort frames share one
# round-robin.
top = read("txsched.v")
top = sub(top, "    wire       pick_any = sc_any || be_any;\n    wire [2:0] pick_idx = sc_any ? sc_idx : be_idx;\n",
          "    wire       pick_any = be_any;\n    wire [2:0] pick_idx = be_idx;\n")
top = sub(top, "        .req  (be_ok),\n", "        .req  (be_ok | sc_ok),\n")
VARIANTS["naive_e"] = {"txsched.v": top}

for name, files in VARIANTS.items():
    d = os.path.join(RTL, name)
    os.makedirs(d, exist_ok=True)
    for f in FILES:
        src = files.get(f, read(f))
        open(os.path.join(d, f), "w", encoding="utf-8", newline="\n").write(src)
    print("wrote", name)

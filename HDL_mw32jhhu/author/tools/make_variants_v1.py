"""Derive the wrong changes from gold: author/rtl/gold -> author/rtl/naive_{a,b,c}.

naive_a  partial feature: rev C latency, late write and deeper queue, but reads
         may follow writes at once (no write-to-read spacing).
naive_b  shortcut: everything as gold, but read latency 2 (LAT low, the strap
         before ECO-117).
naive_c  partial feature: as gold, but the output queue keeps its 4 entries.
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
RTL = os.path.join(HERE, "..", "rtl")

def sub(s, a, b):
    assert s.count(a) == 1, ("not unique", a[:70])
    return s.replace(a, b)

def load(name):
    return {f: open(os.path.join(RTL, "gold", f), encoding="utf-8").read() for f in ("pktbuf.v", "pktbuf_egress.v")}

def save(name, files):
    d = os.path.join(RTL, name); os.makedirs(d, exist_ok=True)
    for f, s in files.items():
        open(os.path.join(d, f), "w", encoding="utf-8", newline="\n").write(s)

v = load("gold")
v["pktbuf.v"] = sub(v["pktbuf.v"],
    "wire rd_avail   = cfg_cut_through ? (rd_ptr != wr_ptr_d2) : (vis_cnt != 0);",
    "wire rd_avail   = cfg_cut_through ? (rd_ptr != wr_ptr) : head_valid;")
save("naive_a", v)

v = load("gold")
e = v["pktbuf_egress.v"]
e = sub(e, "    wire        q_push    = rd_p3;", "    wire        q_push    = rd_p2;")
e = sub(e, """            q_last[q_wp] <= tag_last3;
            q_err[q_wp]  <= tag_err3 && tag_last3;""", """            q_last[q_wp] <= tag_last2;
            q_err[q_wp]  <= tag_err2 && tag_last2;""")
e = sub(e, """                          + {{QW{1'b0}}, rd_p2} + {{QW{1'b0}}, rd_p3};""", """                          + {{QW{1'b0}}, rd_p2};""")
v["pktbuf_egress.v"] = e
save("naive_b", v)

v = load("gold")
e = v["pktbuf_egress.v"]
e = sub(e, """    localparam QD = 8;      // output queue entries: up to 4 reads in flight
    localparam QW = 3;      // log2(QD)""", """    localparam QD = 4;      // output queue entries
    localparam QW = 2;      // log2(QD)""")
v["pktbuf_egress.v"] = e
save("naive_c", v)
print("variants written")

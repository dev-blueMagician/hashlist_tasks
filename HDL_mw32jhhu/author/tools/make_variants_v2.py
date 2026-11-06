"""Version 2 wrong changes, derived from author/v2/rtl/gold (cut-through bypass).

naive_a  partial feature: rev C timing done right (latency 3, late write,
         write-to-read spacing, 8-entry queue) but no cut-through bypass, so the
         first-beat latency in cut-through is 8 cycles (= version 1 gold).
naive_b  shortcut: as gold, but read latency 2 (LAT low, the strap on the
         released schematic, before ECO-117).
naive_c  plausible bypass: as gold, but cut-through reads use "rd_ptr != write
         pointer delayed two cycles", which is wrong once a bypass has moved
         rd_ptr past the delayed pointer.
naive_d  as gold, but the output queue keeps its 4 entries.
naive_e  as gold, but no write-to-read spacing: reads may follow writes at once.
"""
import os, shutil
HERE = os.path.dirname(os.path.abspath(__file__))
V2 = os.path.join(HERE, "..", "v2", "rtl")
V1GOLD = os.path.join(HERE, "..", "v1", "rtl", "gold")
FILES = ("pktbuf.v", "pktbuf_egress.v")

def sub(s, a, b):
    assert s.count(a) == 1, ("not unique", a[:70])
    return s.replace(a, b)

def load():
    return {f: open(os.path.join(V2, "gold", f), encoding="utf-8").read() for f in FILES}

def save(name, files):
    d = os.path.join(V2, name); os.makedirs(d, exist_ok=True)
    for f, s in files.items():
        open(os.path.join(d, f), "w", encoding="utf-8", newline="\n").write(s)

save("naive_a", {f: open(os.path.join(V1GOLD, f), encoding="utf-8").read() for f in FILES})

v = load(); e = v["pktbuf_egress.v"]
e = sub(e, "    wire        q_push    = rd_p3 || byp;", "    wire        q_push    = rd_p2 || byp;")
e = sub(e, """        end else if (rd_p3) begin
            q_data[q_wp] <= sram_rdata;
            q_last[q_wp] <= tag_last3;
            q_err[q_wp]  <= tag_err3 && tag_last3;""", """        end else if (rd_p2) begin
            q_data[q_wp] <= sram_rdata;
            q_last[q_wp] <= tag_last2;
            q_err[q_wp]  <= tag_err2 && tag_last2;""")
e = sub(e, """                          + {{QW{1'b0}}, rd_p2} + {{QW{1'b0}}, rd_p3};""", """                          + {{QW{1'b0}}, rd_p2};""")
v["pktbuf_egress.v"] = e; save("naive_b", v)

v = load(); t = v["pktbuf.v"]
t = sub(t, """    reg  [AW:0]    safe_cnt;              // cut-through: words the egress may read""", """    reg  [AW:0]    safe_cnt;              // cut-through: words the egress may read
    reg  [AW:0]    wr_ptr_d1, wr_ptr_d2;  // wr_ptr two cycles ago""")
t = sub(t, "    wire rd_avail   = cfg_cut_through ? (safe_cnt != 0) : (vis_cnt != 0);",
           "    wire rd_avail   = cfg_cut_through ? (rd_ptr != wr_ptr_d2) : (vis_cnt != 0);")
t = sub(t, """            wct_d1    <= 1'b0;
            wct_d2    <= 1'b0;""", """            wct_d1    <= 1'b0;
            wct_d2    <= 1'b0;
            wr_ptr_d1 <= {(AW+1){1'b0}};
            wr_ptr_d2 <= {(AW+1){1'b0}};""")
t = sub(t, """            wct_d1    <= wr_go && cfg_cut_through && !byp;""", """            wr_ptr_d1 <= wr_ptr;
            wr_ptr_d2 <= wr_ptr_d1;
            wct_d1    <= wr_go && cfg_cut_through && !byp;""")
v["pktbuf.v"] = t; save("naive_c", v)

v = load(); e = v["pktbuf_egress.v"]
e = sub(e, """    localparam QD = 8;      // output queue entries: up to 4 reads in flight
    localparam QW = 3;      // log2(QD)""", """    localparam QD = 4;      // output queue entries
    localparam QW = 2;      // log2(QD)""")
v["pktbuf_egress.v"] = e; save("naive_d", v)

v = load(); t = v["pktbuf.v"]
t = sub(t, "    wire rd_avail   = cfg_cut_through ? (safe_cnt != 0) : (vis_cnt != 0);",
           "    wire rd_avail   = cfg_cut_through ? (rd_ptr != wr_ptr) : head_valid;")
v["pktbuf.v"] = t; save("naive_e", v)
shutil.rmtree(os.path.join(V2, "naive_base"), ignore_errors=True)
shutil.copytree(os.path.join(HERE, "..", "rtl", "naive_base"), os.path.join(V2, "naive_base"))
print("v2 variants written")

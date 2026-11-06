"""Write package/references/<name>.py from author/rtl/<name>/: each script writes
the design files where the agent saves them (/app/data/pktbuf.v, pktbuf_egress.v)."""
import os
HERE = os.path.dirname(os.path.abspath(__file__))
RTL = os.path.join(HERE, "..", "rtl")
OUT = os.path.join(HERE, "..", "..", "package", "references")
DOC = {
    "gold": "The changed design for board rev C. It has to score 1.00.",
    "naive_base": "naive_base: the design as handed over (board rev B), unchanged. The brief requires it, and it has to score 0.00. The builder names common mistakes by slot, so it is stored as the last one.",
    "naive_a": "Partial feature: rev C timing done right (read latency 3, late write, write-to-read spacing, 8-entry queue, retry flush) but no cut-through bypass, so the cut-through first beat takes 8 or more cycles.",
    "naive_b": "Shortcut: as gold, but read latency 2, taken from the LAT strap on the released schematic (before ECO-117).",
    "naive_c": "Plausible bypass: as gold, but cut-through reads compare rd_ptr with the write pointer delayed two cycles, which lets reads run ahead once a bypass has moved rd_ptr past it.",
    "naive_d": "Partial feature: as gold, but the output queue keeps its 4 entries, so reads cannot run at one word per cycle.",
    "naive_e": "Partial feature: as gold, but no write-to-read spacing: a read may follow a write to the same address at once (the datasheet excerpt does not mention write-through; the bring-up capture shows there is none).",
    "naive_f": "Partial feature: as gold, but a retry clears only the first two read-pipeline stages, as the rev B design did, so reads still in flight land in the output queue after the flush.",
}
os.makedirs(OUT, exist_ok=True)
for name, doc in DOC.items():
    parts = ['"""%s"""' % doc]
    for f in ("pktbuf.v", "pktbuf_egress.v"):
        src = open(os.path.join(RTL, name, f), encoding="utf-8").read()
        assert "'''" not in src and "\\" not in src
        parts.append('open("/app/data/%s", "w").write(r\'\'\'%s\'\'\')' % (f, src))
    open(os.path.join(OUT, name + ".py"), "w", encoding="utf-8", newline="\n").write("\n".join(parts) + "\n")
    print("wrote", name + ".py")

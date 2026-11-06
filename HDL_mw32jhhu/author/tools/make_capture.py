"""Write docs/ila_sram_sn0007.csv: an ILA capture of the pktbuf SRAM ports on a
rev C board (NW61P1024, LAT high) while the bring-up exerciser runs.

One row per rising clock edge: the values present at that edge, which is
when the SRAM samples ce_n/we_n/addr/wdata and when the FPGA would capture
rdata. The device model is the one in verifier/tb_pktbuf.v: read data is on
Q for capture at command edge + 3, write data is sampled at command edge + 1,
the array is updated at command edge + 2 (a read at + 1 or + 2 sees the old
word). Q outside a read data cycle shows arbitrary values.

Exerciser steps (as described in docs/board_rev_c_notes.md):
  1 write 0x000-0x00F with pattern A
  2 read 0x000-0x00F back
  3 write 0x000-0x00F with pattern B
  4 for k = 0..4 idle cycles: three addresses, each written with pattern C,
    then k idle cycles, then read
"""
import os, random
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "..", "package", "environment", "data", "docs", "ila_sram_sn0007.csv")
rng = random.Random(70007)

pins = []          # (ce_n, we_n, addr, wdata) per edge
last_addr = 0
pending_wdata = None

def edge(ce_n, we_n, addr=None, data_for_next=None):
    """Drive one edge. data_for_next: the write data to put on D at the NEXT edge."""
    global last_addr, pending_wdata
    if addr is None:
        addr = last_addr
    last_addr = addr
    wd = pending_wdata if pending_wdata is not None else 0
    pending_wdata = data_for_next
    pins.append((ce_n, we_n, addr, wd))

def idle(n):
    for _ in range(n):
        edge(1, 1)

def write(addr, data):
    edge(0, 0, addr, data)

def read(addr):
    edge(0, 1, addr)

A = lambda i: 0xC0DE0000 | i
B = lambda i: 0x5EED0000 | (i * 0x11)
C = lambda k, a: 0xF00D0000 | (k << 8) | a

idle(4)
for i in range(16): write(i, A(i))
idle(4)
for i in range(16): read(i)
idle(6)
for i in range(16): write(i, B(i))
idle(6)
for k in range(5):
    for j in range(3):
        a = 3 * k + j
        write(a, C(k, a))
        idle(k)
        read(a)
        idle(6)
idle(6)

# device model
mem = {i: rng.getrandbits(32) for i in range(1024)}
rows = []
w1 = None; w2 = None          # (addr) at n, (addr, data) at n+1
rpipe = [None, None, None]    # data read at n, n-1, n-2
for n, (ce_n, we_n, addr, wd) in enumerate(pins):
    # Q at this edge: data of a read commanded at edge n-3
    q = rpipe[2] if rpipe[2] is not None else rng.getrandbits(32)
    rows.append((n, ce_n, we_n, addr, wd, q))
    # read at this edge samples the array before this edge's update
    rdata = mem[addr] if (ce_n == 0 and we_n == 1) else None
    # array update for the write commanded at n-2 (its data was sampled at n-1)
    if w2 is not None:
        mem[w2[0]] = w2[1]
    w2 = (w1, wd) if w1 is not None else None
    w1 = addr if (ce_n == 0 and we_n == 0) else None
    rpipe = [rdata, rpipe[0], rpipe[1]]

with open(OUT, "w", encoding="utf-8", newline="\n") as f:
    f.write("cycle,sram_ce_n,sram_we_n,sram_addr,sram_wdata,sram_rdata\n")
    for n, ce_n, we_n, addr, wd, q in rows:
        f.write("%d,%d,%d,%03x,%08x,%08x\n" % (n, ce_n, we_n, addr, wd, q))
print("wrote", OUT, len(rows), "rows")

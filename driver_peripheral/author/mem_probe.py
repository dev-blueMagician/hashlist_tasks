"""Measure drive.py's memory and time per traced SPI frame (synthetic trace)."""
import os
import sys
import time
import tracemalloc

sys.path.insert(0, sys.argv[1])
import drive  # noqa: E402

N = int(sys.argv[2]) if len(sys.argv) > 2 else 500_000
path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "synthetic.log")

w = "memory_region_ops_write cpu 0 mr 0x55d5c3a1b2c0 addr 0x%08x value 0x%x size 4\n"
with open(path, "w") as f:
    # LDO, PLL at 50 MHz, clocks, pins, SSI enabled: a plausible steady state
    f.write(w % (0x400FE034, 0x1B))
    f.write(w % (0x400FE060, 0x01CE3B80 | 0x800))
    f.write(w % (0x400FE060, 0x01CE3380 | 0x400000))
    f.write(w % (0x400FE104, 0x11))
    f.write(w % (0x400FE108, 0x09))
    f.write(w % (0x40004420, 0x37))
    f.write(w % (0x4000451C, 0x3F))
    f.write(w % (0x40007400, 0x01))
    f.write(w % (0x4000751C, 0x01))
    f.write(w % (0x40008000, 0x07))
    f.write(w % (0x40008010, 0x7E))
    f.write(w % (0x40008004, 0x02))
    for i in range(N):
        if i % 9 == 0:
            f.write(w % (0x40007004, i // 9 % 2))      # PD0 select / deselect
        f.write(w % (0x40008008, 0xFF))
size = os.path.getsize(path)

tracemalloc.start()
t0 = time.perf_counter()
b = drive.Board("probe")
drive.feed_file(b, path)
t1 = time.perf_counter()
cur, peak = tracemalloc.get_traced_memory()
tracemalloc.stop()
os.remove(path)
print("frames=%d log=%.1f MB time=%.1f s peak=%.1f MB  -> per frame: %.0f bytes log, %.0f bytes RAM, %.1f us"
      % (len(b.frames), size / 1e6, t1 - t0, peak / 1e6, size / N, peak / N, (t1 - t0) / N * 1e6))

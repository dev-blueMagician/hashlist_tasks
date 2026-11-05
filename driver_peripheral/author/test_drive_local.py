"""Host-only checks of drive.py logic (no QEMU): CRC7, clock model, trace parsing, rules.

Narrow evidence only; the firmware and QEMU route is checked in the box.
usage: python -I author/test_drive_local.py [path/to/drive.py]
"""
import importlib.util
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DRIVE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", "package", "verifier", "drive.py")
print("testing", os.path.normpath(DRIVE))
spec = importlib.util.spec_from_file_location("drive", DRIVE)
drive = importlib.util.module_from_spec(spec)
spec.loader.exec_module(drive)

fails = 0


def check(cond, msg):
    global fails
    print(("ok   " if cond else "FAIL ") + msg)
    if not cond:
        fails += 1


# CRC7 of the two fixed command frames every SPI-mode driver sends
check((drive.crc7([0x40, 0, 0, 0, 0]) << 1 | 1) == 0x95, "CMD0 CRC byte 0x95")
check((drive.crc7([0x48, 0, 0, 1, 0xAA]) << 1 | 1) == 0x87, "CMD8 CRC byte 0x87")

# clock model: reset = IOSC +-30 %
c = drive.Clock()
ok, lo, hi, why = c.state()
check(ok and abs(lo - 8.4e6) < 1 and abs(hi - 15.6e6) < 1, "reset clock is IOSC 8.4-15.6 MHz (%s)" % why)

# gold sequence (RCC only)
b = drive.Board("gold")
w = b.write
w(0x400FE034, 0x1B)
rcc = 0x078E3AD1
rcc |= 0x800; rcc &= ~0x400000; w(0x400FE060, rcc)
rcc &= ~1; w(0x400FE060, rcc)
rcc &= ~(0x3C0 | 0x30 | 0x2000); rcc |= 0x380; w(0x400FE060, rcc)
rcc &= ~0x07800000; rcc |= 0x01800000 | 0x400000; w(0x400FE060, rcc)
rcc &= ~0x800; w(0x400FE060, rcc)
ok, lo, hi, why = b.sysclk()
check(ok and lo == hi == 50e6, "gold sequence ends at 50 MHz (%s)" % why)
check(not b.viol["clock_ok"], "gold sequence never has an invalid clock %s" % b.viol["clock_ok"])
check(b.pll_used and b.ldo_at_pll == 0x1B, "gold raised the LDO before powering the PLL")

# naive TM4C123-style sequence through RCC2, MOSCDIS never cleared
b = drive.Board("naive")
w = b.write
rcc2 = 0x07802810 | 0x80000000; w(0x400FE070, rcc2)
rcc2 |= 0x800; w(0x400FE070, rcc2)
rcc = (0x078E3AD1 & ~0x7C0) | 0x380; w(0x400FE060, rcc)
rcc2 &= ~0x70; w(0x400FE070, rcc2)
rcc2 &= ~0x2000; w(0x400FE070, rcc2)
rcc2 |= 0x40000000; w(0x400FE070, rcc2)
rcc2 = (rcc2 & ~0x1FC00000) | (7 << 22); w(0x400FE070, rcc2)
rcc2 &= ~0x800; w(0x400FE070, rcc2)
ok, lo, hi, why = b.sysclk()
check(not ok and "MOSCDIS" in why, "naive ends with the PLL fed by a disabled oscillator (%s)" % why)
check(bool(b.viol["clock_ok"]), "naive gets a clock_ok violation")
check(b.ldo_at_pll == 0, "naive powered the PLL with the LDO at its default")

# RCC2 path with MOSC enabled and SYSDIV2=3 is accepted; SYSDIV below MINSYSDIV is clamped
b = drive.Board("rcc2")
b.write(0x400FE060, 0x078E3AD1 & ~1)                 # MOSCDIS=0
b.write(0x400FE070, 0x80000000 | (3 << 23))          # USERCC2, SYSDIV2=3, BYPASS2=0, PWRDN2=0, OSCSRC2=0
b.write(0x400FE060, (0x078E3AD1 & ~1 & ~0x3C0) | 0x380)
ok, lo, hi, why = b.sysclk()
check(ok and lo == 50e6, "RCC2 PLL at /4 is 50 MHz (%s)" % why)
b.write(0x400FE070, 0x80000000 | (1 << 23))
ok, lo, hi, why = b.sysclk()
check(ok and lo == 50e6, "SYSDIV2=1 with the PLL is clamped to MINSYSDIV (%.0f)" % lo)

# trace line parsing (formats seen in probe 1)
ev = drive.parse_line("memory_region_ops_write cpu 0 mr 0x55e9587ab650 addr 0x400fe104 value 0x10 size 4 name 'ssys'")
check(ev == ("w", 0x400FE104, 0x10, 4), "parse memory write %r" % (ev,))
ev = drive.parse_line("Trace 0: 0x7f5c40000100 [00000000/00000040/00000000/ff200000] reset")
check(ev == ("x", 0x40), "parse exec line %r" % (ev,))

# GPIO masking as QEMU's PL061, SSI rules, OLED select, UART latch
b = drive.Board("rules")
w = b.write
w(0x400FE104, 0x11); w(0x400FE108, 0x09)
w(0x40007400, 0x01); w(0x4000751C, 0x01)
w(0x40007000, 0x00)                                  # unmasked address: no effect
check(b.gpio["D"]["data"] == 0, "GPIODATA at offset 0 writes nothing")
w(0x40007004, 0x01)
check(b.gpio["D"]["data"] == 1, "GPIODATA at offset 4 sets PD0")
w(0x40004420, 0x3C); w(0x4000451C, 0x3C)            # PA2-PA5 SSI, PA3 as SSI0Fss
w(0x40008004, 0); w(0x40008010, 125); w(0x40008000, 0x07); w(0x40008004, 2)
w(0x40008010, 2)                                     # reprogram while enabled
check(bool(b.viol["ssi_reconfig_ok"]), "CPSR write with SSE=1 flagged")
w(0x40008008, 0xFF)
check(bool(b.viol["oled_cs_ok"]), "frame with PA3 as SSI0Fss flagged")
b2 = drive.Board("uart")
w = b2.write
w(0x400FE104, 0x01); w(0x400FE108, 0x01); w(0x40004420, 0x03); w(0x4000451C, 0x03)
w(0x4000C030, 0); w(0x4000C024, 6); w(0x4000C028, 33); w(0x4000C02C, 0x70); w(0x4000C030, 0x301)
w(0x4000C000, 0x41)
check(any("baud" in v for v in b2.viol["card_io_ok"]), "UART from IOSC flagged for baud tolerance")

# the bench helper and the grader start the CPU in the same RCC shim
import re
with open(os.path.join(HERE, "..", "package", "environment", "data", "run-sd.sh")) as f:
    octal = re.search(r"printf '([^']*)'", f.read()).group(1)
shim = bytes(int(x, 8) for x in re.findall(r"\\(\d{3})", octal))
check(shim == drive.RCC_SHIM and len(shim) == 24, "run-sd.sh shim bytes equal drive.RCC_SHIM (%s)" % shim.hex())
check(drive.RCC_SHIM[16:20] == (0x400FE060).to_bytes(4, "little")
      and drive.RCC_SHIM[20:24] == (0x078E3AD1).to_bytes(4, "little"), "shim literals are RCC and its reset value")

# sessions: repeated CMD0 stays one session, a later CMD0 after other commands starts the next
b = drive.Board("sess")
for i in range(40):
    b.frames.append((i, 0xFF, 10 <= i < 30 or i >= 34, 3e5, 3e5))
b.events = [("cmd", 0, 0, "idle", 15), ("cmd", 0, 0, "idle", 21), ("cmd", 8, 0x1AA, "idle", 27),
            ("cmd", 0, 0, "transfer", 39)]
ses = drive.sessions(b)
check(len(ses) == 2 and len(ses[0]["cmds"]) == 3, "retried CMD0 grouped, re-init split (%d sessions)" % len(ses))
check(ses[0]["first_low"] == 10 and ses[0]["high_start"] == 0, "first session bounds %r" % ((ses[0]["first_low"], ses[0]["high_start"]),))
check(ses[0]["stop"] == 30 and ses[1]["first_low"] == 34 and ses[1]["high_start"] == 30,
      "data window stops at the next power-up clocks (%r)" % ses[0].get("stop"))

# the grader passes /tmp/built, which may be the image itself or a directory holding it
import tempfile
with tempfile.TemporaryDirectory() as d:
    sub = os.path.join(d, "out")
    os.mkdir(sub)
    with open(os.path.join(sub, "notes.txt"), "wb") as f:
        f.write(b"text")
    with open(os.path.join(sub, "image"), "wb") as f:
        f.write(b"\x7fELF" + b"\0" * 60)
    check(drive.find_elf(d) == os.path.join(sub, "image"), "find_elf picks the ELF inside a directory")
    check(drive.find_elf(os.path.join(sub, "image")) == os.path.join(sub, "image"), "find_elf accepts the file itself")

# corrected driver only: trace and time limits (Qemu.line itself needs select() on a pipe: not on Windows)
if hasattr(drive, "TraceLimit"):
    w = "memory_region_ops_write cpu 0 mr 0x1 addr 0x%08x value 0x%x size 4\n"
    with tempfile.TemporaryDirectory() as d:
        log = os.path.join(d, "t.log")
        with open(log, "w") as f:
            f.write(w % (0x400FE034, 0x1B))
            f.write(w % (0x400FE104, 0x10))
            for i in range(50):
                f.write(w % (0x40008008, 0xFF))
        b = drive.Board("cap")
        check(drive.feed_file(b, log, 20) is False and b.ldopctl == 0x1B and len(b.frames) == 18,
              "feed_file stops at max_lines and reports the cut (%d frames)" % len(b.frames))
        b = drive.Board("full")
        check(drive.feed_file(b, log, 1000) is True and len(b.frames) == 50, "feed_file reads a short trace whole")
        q = object.__new__(drive.Qemu)
        q.log, q.trace_limit = log, 1000
        try:
            q.check_trace()
            check(False, "check_trace raises past the limit")
        except drive.TraceLimit as e:
            check("MiB" in str(e), "check_trace raises past the limit (%s)" % e)
        q.trace_limit = 1 << 20
        q.check_trace()
        q.log = os.path.join(d, "missing.log")
        q.check_trace()
        check(True, "check_trace quiet under the limit and for a missing log")
    parse = drive.FEED_LIMIT * 15e-6            # measured 13 us per trace line on the author PC
    worst = 3 * (drive.RUN_BUDGET + parse + 2) + drive.TIMING_BUDGET + 5
    worst += 4 * (getattr(drive, "PROBE_BUDGET", 0) + 2)
    check(worst < 270, "worst-case run time %.0f s (parse %.0f s per run) leaves 30 s under the 300 s test timeout"
          % (worst, parse))

# the two short runs against a simulated firmware (the rules, not QEMU or a real image)
if hasattr(drive, "range_run"):
    disk = {}


    class FakeFirmware:
        """Answers the host protocol as a firmware with the given faults would."""
        wraps = False           # byte address kept in 32 bits, no check of the block number
        line_limit = 1100       # characters of a command line kept
        fails_init = False
        hangs = False

        def __init__(self, elf, img, v1, log, errlog, **kw):
            self.img, self.v1, self.replies = img, v1, []
            self.blocks = disk[img]["size"] // drive.BLOCK
            self.hc = disk[img]["size"] > (2 << 30)

        def expect_ready(self):
            pass

        def send(self, text):
            cards = disk[self.img]["blocks"]
            if text == "I":
                kind = "SDV1" if self.v1 else "SDHC" if self.hc else "SDSC"
                self.replies.append("ERR 2" if self.fails_init else "OK " + kind)
                return
            op, lba = text.split()[:2]
            lba = int(lba)
            if len(text) > self.line_limit:
                self.replies.append("ERR 0")
                return
            if not self.hc:
                if lba > 0x7FFFFF and not self.wraps:
                    self.replies.append("ERR 7")
                    return
                lba = (lba * 512 & 0xFFFFFFFF) // 512
            if lba >= self.blocks:
                self.replies.append("ERR 1")
            elif op == "R":
                self.replies.append("DATA " + cards.get(lba, bytes(drive.BLOCK)).hex())
            else:
                cards[lba] = bytes.fromhex(text.split()[2])
                self.replies.append("OK")

        def line(self, timeout):
            if self.hangs:
                raise TimeoutError("no reply from the firmware")
            return self.replies.pop(0)

        def stop(self):
            pass


    def fake_make_card(path, size, rng, lbas):
        content = {lba: bytes(rng.getrandbits(8) for _ in range(drive.BLOCK)) for lba in lbas}
        disk[path] = {"size": size, "blocks": dict(content)}
        return content


    def fake_read_card(path, lba):
        return disk[path]["blocks"].get(lba, bytes(drive.BLOCK))


    drive.Qemu, drive.make_card, drive.read_card = FakeFirmware, fake_make_card, fake_read_card
    import random
    rng = random.Random(1)
    CARD_NAMES = ("SDHC", "SDSC", "SDV1")


    def range_reasons():
        return [r for name in CARD_NAMES for r in drive.range_run("e", "w", name, rng, "s")]


    def large_reasons():
        return drive.large_card_run("e", "w", rng, "s")


    check(range_reasons() == [], "a correct firmware passes range_ok")
    check(large_reasons() == [], "a correct firmware passes large_card_ok")

    FakeFirmware.wraps = True
    r = range_reasons()
    check(any("[SDSC] R 83" in x for x in r) and any("[SDSC] W 83" in x for x in r), "wrapped R and W flagged on SDSC")
    check(any("[SDV1] R 83" in x for x in r), "wrapped R flagged on SDV1")
    check(any("overwritten" in x for x in r), "the overwritten low block is flagged")
    check(not any("[SDHC]" in x for x in r), "SDHC has no wrap to flag")
    check(large_reasons() == [], "the wrap fault leaves large_card_ok alone")
    FakeFirmware.wraps = False

    FakeFirmware.line_limit = 1034
    r = large_reasons()
    check(any("-> 'ERR 0'" in x for x in r), "a 1034-character line limit fails eight-digit writes (%s)" % r[:1])
    check(not any(x.startswith("R ") for x in r), "eight-digit reads still pass with that limit")
    check(range_reasons() == [], "the line limit leaves range_ok alone")
    FakeFirmware.line_limit = 1100

    FakeFirmware.fails_init = True
    check(range_reasons() != [] and large_reasons() != [], "no vacuous pass when no card initialises")
    FakeFirmware.fails_init = False
    FakeFirmware.hangs = True
    check(range_reasons() != [] and large_reasons() != [], "a firmware that stops answering fails both")
    FakeFirmware.hangs = False

# the package: the starter's fault, gold's fix, and what the prompt must not say
ROOT = os.path.join(HERE, "..", "package")


def line_size(rel):
    with open(os.path.join(ROOT, *rel.split("/"))) as f:
        return int(re.search(r"static char line\[(\d+)\]", f.read()).group(1))


for rel, size in (("environment/data/starter/firmware.c", 1035), ("references/naive_a.c", 1035)):
    check(line_size(rel) == size, "%s keeps %d bytes: 7-digit blocks fit, 8-digit do not" % (rel, size))
check(line_size("references/gold.c") >= 2 + 10 + 1 + 1024 + 1, "gold's line buffer holds a ten-digit block number")
with open(os.path.join(ROOT, "references", "gold.c")) as f:
    check("lba > 0x007FFFFFu" in f.read(), "gold refuses blocks whose byte address overflows")
with open(os.path.join(ROOT, "agent", "PROMPT.md"), encoding="utf-8") as f:
    prompt = f.read()
for word in ("A2", "revision", "LDO", "OLED", "locked up", "lock-up", "2 GB"):
    check(word not in prompt, "the prompt does not say %r" % word)
check("/app/data/service-log.txt" in prompt, "the prompt names the service log")
with open(os.path.join(ROOT, "environment", "data", "service-log.txt")) as f:
    log = f.read()
check("10010002" in log and "A2" not in log and "OLED" not in log, "the log gives DID0, not the revision or the display")

print("\n%d failure(s)" % fails)
sys.exit(1 if fails else 0)

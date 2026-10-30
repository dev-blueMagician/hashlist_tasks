"""Hidden driver: microSD bring-up on the EK-LM3S6965 (QEMU lm3s6965evb).

Runs the built firmware with three microSD cards (SDHC, SDSC, SD v1) and once
more with instruction tracing, talks to it over UART0, and evaluates the
register writes QEMU logs against the datasheet, errata, board manual and the
task requirements. Prints one metric=value line per check (1 pass, 0 fail);
reasons go to stderr.

usage: python3 drive.py firmware.elf
"""
import json
import os
import random
import re
import select
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time

QEMU = os.environ.get("QEMU", "qemu-system-arm")
BLOCK = 512

# test_outputs.py kills this driver after 300 s, so every run is bounded:
# worst case about 3 x (40 s + ~15 s parsing) + 80 s. A correct firmware needs a
# few seconds in total and writes about 2 MB of trace per functional run.
RUN_BUDGET = 40                 # seconds per functional run
TIMING_BUDGET = 80              # seconds for the instruction-traced run
TRACE_LIMIT = 64 << 20          # bytes of QEMU trace per functional run
FEED_LIMIT = 1_000_000          # trace lines evaluated per functional run

METRICS = [
    "card_io_ok",       # data, card type, SD SPI rules, pins, clock gating, UART, data-phase bit rate
    "clock_ok",         # 50 MHz from the 8 MHz crystal through the PLL; never an invalid clock
    "ldo_errata_ok",    # LDO raised to 2.75 V before the PLL is powered (errata LM3SYSCTL#09)
    "id_clock_ok",      # card identification at 100-400 kHz
    "ssi_reconfig_ok",  # SSICR0/SSICPSR written only with SSE clear
    "oled_cs_ok",       # OLED chip select (PA3) never asserted while the SSI clocks frames
    "reinit_ok",        # a second card initialisation works and is again at 100-400 kHz
    "rcgc_delay_ok",    # >= 3 system clocks between a module clock enable and its first access
]

# ---------------------------------------------------------------- trace parsing

RE_MEM = re.compile(r"^memory_region_ops_(read|write) cpu \d+ mr 0x[0-9a-f]+ addr 0x([0-9a-f]+) "
                    r"value 0x([0-9a-f]+) size (\d+)")
RE_EXEC = re.compile(r"^Trace \d+: 0x[0-9a-f]+ \[[0-9a-f]+/([0-9a-f]+)/")
RE_CMD = re.compile(r"^sdcard_normal_command .*?CMD(\d+) arg 0x([0-9a-f]+) \(state (\w+)\)")
RE_ACMD = re.compile(r"^sdcard_app_command .*?ACMD(\d+) arg 0x([0-9a-f]+) \(state (\w+)\)")
RE_WBLK = re.compile(r"^sdcard_write_block addr 0x([0-9a-f]+) size 0x([0-9a-f]+)")


def parse_line(line):
    m = RE_MEM.match(line)
    if m:
        return (m.group(1)[0], int(m.group(2), 16), int(m.group(3), 16), int(m.group(4)))
    m = RE_EXEC.match(line)
    if m:
        return ("x", int(m.group(1), 16))
    m = RE_CMD.match(line)
    if m:
        return ("cmd", int(m.group(1)), int(m.group(2), 16), m.group(3))
    m = RE_ACMD.match(line)
    if m:
        return ("acmd", int(m.group(1)), int(m.group(2), 16), m.group(3))
    m = RE_WBLK.match(line)
    if m:
        return ("wblk", int(m.group(1), 16), int(m.group(2), 16))
    return None


# ---------------------------------------------------------------- board model

SYSCTL = 0x400FE000
GPIO_PORTS = {0x40004000: "A", 0x40005000: "B", 0x40006000: "C", 0x40007000: "D",
              0x40024000: "E", 0x40025000: "F", 0x40026000: "G"}
UART0 = 0x4000C000
SSI0 = 0x40008000

# (RCGC register offset, bit) -> module base; each module spans 4 KiB
CLOCK_GATES = {
    (0x104, 0): UART0, (0x104, 1): 0x4000D000, (0x104, 2): 0x4000E000,
    (0x104, 4): SSI0, (0x104, 12): 0x40020000,
    (0x104, 16): 0x40030000, (0x104, 17): 0x40031000, (0x104, 18): 0x40032000, (0x104, 19): 0x40033000,
    (0x108, 0): 0x40004000, (0x108, 1): 0x40005000, (0x108, 2): 0x40006000, (0x108, 3): 0x40007000,
    (0x108, 4): 0x40024000, (0x108, 5): 0x40025000, (0x108, 6): 0x40026000,
    (0x100, 3): 0x40000000, (0x100, 16): 0x40038000,
}
GATE_OF = {base: key for key, base in CLOCK_GATES.items()}

CRYSTAL_HZ = 8000000            # EK-LM3S6965 main crystal
XTAL_8MHZ = 0xE
MINSYSDIV = 3                   # 50 MHz part


def module_of(addr):
    base = addr & ~0xFFF
    return base if base in GATE_OF else None


class Clock:
    """System clock per datasheet 5.2.4 (RCC/RCC2), as (valid, fmin, fmax, why)."""

    def __init__(self):
        self.rcc = 0x078E3AD1
        self.rcc2 = 0x07802810

    def fields(self):
        rcc, rcc2 = self.rcc, self.rcc2
        use2 = rcc2 >> 31 & 1
        return {
            "bypass": (rcc2 >> 11 & 1) if use2 else (rcc >> 11 & 1),
            "pwrdn": (rcc2 >> 13 & 1) if use2 else (rcc >> 13 & 1),
            "oscsrc": (rcc2 >> 4 & 7) if use2 else (rcc >> 4 & 3),
            "sysdiv": (rcc2 >> 23 & 0x3F) if use2 else (rcc >> 23 & 0xF),
            "usesysdiv": rcc >> 22 & 1,
            "moscdis": rcc & 1,
            "ioscdis": rcc >> 1 & 1,
            "xtal": rcc >> 6 & 0xF,
        }

    def state(self):
        f = self.fields()
        if not f["bypass"]:
            if f["pwrdn"]:
                return (False, 0, 0, "PLL selected while powered down")
            if f["oscsrc"] != 0:
                return (False, 0, 0, "PLL reference is not the main oscillator")
            if f["moscdis"]:
                return (False, 0, 0, "PLL reference (main oscillator) is disabled (MOSCDIS=1)")
            if f["xtal"] != XTAL_8MHZ:
                return (False, 0, 0, "XTAL=0x%X does not match the 8 MHz crystal" % f["xtal"])
            hz = 200e6 / (max(f["sysdiv"], MINSYSDIV) + 1)
            return (True, hz, hz, "PLL")
        src = f["oscsrc"]
        if src == 0:
            if f["moscdis"]:
                return (False, 0, 0, "running from the main oscillator while it is disabled")
            lo = hi = CRYSTAL_HZ
        elif src == 1:
            if f["ioscdis"]:
                return (False, 0, 0, "running from the internal oscillator while it is disabled")
            lo, hi = 12e6 * 0.7, 12e6 * 1.3
        elif src == 2:
            lo, hi = 3e6 * 0.7, 3e6 * 1.3
        elif src == 3:
            lo, hi = 30e3 * 0.5, 30e3 * 1.5
        elif src == 7:
            lo = hi = 32768
        else:
            return (False, 0, 0, "reserved oscillator source %d" % src)
        if f["usesysdiv"]:
            div = f["sysdiv"] + 1
            lo, hi = lo / div, hi / div
        return (True, lo, hi, "oscillator %d" % src)


class Board:
    """Register state reconstructed from the write trace, plus rule bookkeeping."""

    def __init__(self, label):
        self.label = label
        self.clock = Clock()
        self.ldopctl = 0
        self.rcgc = {0x100: 0, 0x104: 0, 0x108: 0}
        self.gpio = {p: {"data": 0, "dir": 0, "afsel": 0, "den": 0} for p in "ABCDEFG"}
        self.uart = {"ibrd": 0, "fbrd": 0, "lib": 0, "lfb": 0, "lcrh": 0, "ctl": 0x300}
        self.ssi = {"cr0": 0, "cr1": 0, "cpsr": 0}
        self.viol = {m: [] for m in METRICS}
        self.pll_used = False
        self.pll_powered_once = False
        self.ldo_at_pll = None
        self.tx_bytes = 0
        self.frames = []        # (index, value, card selected, lo_hz, hi_hz)
        self.events = []        # ("frame", i) / ("cmd"/"acmd", cmd, arg, state, last_frame)
        self.write_blocks = []
        self.initialised = False

    def note(self, metric, msg):
        if len(self.viol[metric]) < 8:
            self.viol[metric].append(msg)
        elif len(self.viol[metric]) == 8:
            self.viol[metric].append("...")

    # -- helpers
    def gated(self, base):
        off, bit = GATE_OF[base]
        return self.rcgc[off] >> bit & 1

    def pin(self, port, bit):
        g = self.gpio[port]
        return {k: g[k] >> bit & 1 for k in g}

    def sysclk(self):
        return self.clock.state()

    # -- writes
    def write(self, addr, value):
        if SYSCTL <= addr < SYSCTL + 0x1000:
            self.write_sysctl(addr - SYSCTL, value)
            return
        mod = module_of(addr)
        if mod is not None and not self.gated(mod):
            self.note("card_io_ok", "write to 0x%08x before its module clock is enabled" % addr)
        base = addr & ~0xFFF
        if base in GPIO_PORTS:
            self.write_gpio(GPIO_PORTS[base], addr - base, value)
        elif base == UART0:
            self.write_uart(addr - base, value)
        elif base == SSI0:
            self.write_ssi(addr - base, value)

    def write_sysctl(self, off, value):
        if off == 0x034:
            self.ldopctl = value & 0x3F
        elif off in (0x060, 0x070):
            before = self.clock.fields()
            if off == 0x060:
                self.clock.rcc = value
            else:
                self.clock.rcc2 = value
            after = self.clock.fields()
            if before["pwrdn"] and not after["pwrdn"] and not self.pll_powered_once:
                self.pll_powered_once = True
                self.ldo_at_pll = self.ldopctl
            if not after["bypass"]:
                self.pll_used = True
            ok, _, _, why = self.clock.state()
            if not ok:
                self.note("clock_ok", "invalid system clock after RCC%s write 0x%08x: %s"
                          % ("2" if off == 0x070 else "", value, why))
        elif off in self.rcgc:
            self.rcgc[off] = value

    def write_gpio(self, port, off, value):
        g = self.gpio[port]
        if off < 0x400:
            mask = (off >> 2) & 0xFF & g["dir"]     # as QEMU's PL061: only output bits change
            g["data"] = (g["data"] & ~mask) | (value & mask)
        elif off == 0x400:
            g["dir"] = value & 0xFF
        elif off == 0x420:
            g["afsel"] = value & 0xFF
        elif off == 0x51C:
            g["den"] = value & 0xFF

    def write_uart(self, off, value):
        u = self.uart
        if off == 0x000:
            self.check_tx()
        elif off == 0x024:
            u["ibrd"] = value & 0xFFFF
        elif off == 0x028:
            u["fbrd"] = value & 0x3F
        elif off == 0x02C:
            u["lcrh"] = value & 0xFF
            u["lib"], u["lfb"] = u["ibrd"], u["fbrd"]   # divisor latched by the LCRH write
        elif off == 0x030:
            u["ctl"] = value

    def check_tx(self):
        self.tx_bytes += 1
        u = self.uart
        ok, lo, hi, why = self.sysclk()
        if not ok:
            self.note("card_io_ok", "UART byte sent with an invalid system clock (%s)" % why)
        elif not (abs(lo - 50e6) <= 0.25e6 and abs(hi - 50e6) <= 0.25e6):
            self.note("clock_ok", "UART output while the system clock is %.3f-%.3f MHz, not 50 MHz"
                      % (lo / 1e6, hi / 1e6))
        if not self.gated(UART0) or not self.gated(0x40004000):
            self.note("card_io_ok", "UART0 or GPIOA clock not enabled while transmitting")
        for bit, name in ((0, "PA0/U0RX"), (1, "PA1/U0TX")):
            p = self.pin("A", bit)
            if not (p["afsel"] and p["den"]):
                self.note("card_io_ok", "%s not configured as UART (AFSEL/DEN)" % name)
        if (u["ctl"] & 0x301) != 0x301:
            self.note("card_io_ok", "UART0 not enabled for TX and RX (UARTCTL=0x%x)" % u["ctl"])
        if (u["lcrh"] >> 5 & 3) != 3 or u["lcrh"] & 0x0B:
            self.note("card_io_ok", "UART0 line control 0x%02x is not 8N1" % u["lcrh"])
        brd = u["lib"] + u["lfb"] / 64.0
        if ok:
            if brd < 1:
                self.note("card_io_ok", "UART0 baud-rate divisor never latched (no LCRH write after IBRD/FBRD)")
            else:
                for f in (lo, hi):
                    baud = f / (16 * brd)
                    if abs(baud - 115200) > 0.02 * 115200:
                        self.note("card_io_ok", "UART0 at %.0f baud (latched divisor %.4f, sysclk %.2f MHz)"
                                  % (baud, brd, f / 1e6))
                        break

    def write_ssi(self, off, value):
        s = self.ssi
        if off in (0x000, 0x010):
            if s["cr1"] & 0x02:
                self.note("ssi_reconfig_ok", "SSI%s written (0x%x) while SSE=1"
                          % ("CR0" if off == 0 else "CPSR", value))
            s["cr0" if off == 0 else "cpsr"] = value & (0xFFFF if off == 0 else 0xFF)
        elif off == 0x004:
            s["cr1"] = value & 0x0F
        elif off == 0x008:
            self.frame(value)

    def frame(self, value):
        s = self.ssi
        idx = len(self.frames)
        ok, lo, hi, why = self.sysclk()
        cps = s["cpsr"] & 0xFE
        scr = s["cr0"] >> 8 & 0xFF
        if ok and cps >= 2:
            div = cps * (1 + scr)
            rlo, rhi = lo / div, hi / div
        else:
            rlo = rhi = -1.0
        if not ok:
            self.note("card_io_ok", "SSI frame with an invalid system clock (%s)" % why)
        elif not (abs(lo - 50e6) <= 0.25e6 and abs(hi - 50e6) <= 0.25e6):
            self.note("clock_ok", "SSI frame while the system clock is %.3f-%.3f MHz, not 50 MHz"
                      % (lo / 1e6, hi / 1e6))
        if not (s["cr1"] & 0x02) or s["cr1"] & 0x04:
            self.note("card_io_ok", "SSI0 data written while not enabled as master (SSICR1=0x%x)" % s["cr1"])
        if (s["cr0"] & 0x3F) not in (0x07,) or ((s["cr0"] >> 6) & 3) not in (0, 3):
            self.note("card_io_ok", "SSI0 frame format SSICR0=0x%04x is not 8-bit SPI mode 0/3" % s["cr0"])
        if ok and lo < 2 * rhi:
            self.note("card_io_ok", "SSIClk %.0f Hz exceeds SysClk/2 in master mode" % rhi)
        if not (self.gated(SSI0) and self.gated(0x40004000) and self.gated(0x40007000)):
            self.note("card_io_ok", "SSI0/GPIOA/GPIOD clock not enabled while transferring")
        for bit, name in ((2, "PA2/SSI0Clk"), (4, "PA4/SSI0Rx"), (5, "PA5/SSI0Tx")):
            p = self.pin("A", bit)
            if not (p["afsel"] and p["den"]):
                self.note("card_io_ok", "%s not configured for SSI0 (AFSEL/DEN)" % name)
        d0 = self.pin("D", 0)
        selected = bool(d0["dir"] and not d0["data"])      # what QEMU's card sees on PD0
        if selected and not (d0["den"] and not d0["afsel"]):
            self.note("card_io_ok", "PD0 card select is not a digital GPIO output (DEN/AFSEL)")
        a3 = self.pin("A", 3)
        oled_sel = (a3["afsel"] and a3["den"]) or (not a3["afsel"] and a3["dir"] and a3["den"] and not a3["data"])
        if oled_sel:
            self.note("oled_cs_ok", "frame %d clocked with the OLED selected (PA3 %s)"
                      % (idx, "is SSI0Fss" if a3["afsel"] else "driven low"))
        self.frames.append((idx, value & 0xFF, selected, rlo, rhi))
        self.events.append(("frame", idx))

    def sd_event(self, kind, cmd, arg, state):
        self.events.append((kind, cmd, arg, state, len(self.frames) - 1))


def feed_file(board, path, max_lines=None):
    """Replay a functional-run trace; False if it was cut at max_lines."""
    with open(path, errors="replace") as f:
        for n, line in enumerate(f):
            if max_lines is not None and n >= max_lines:
                return False
            ev = parse_line(line)
            if ev is None:
                continue
            if ev[0] == "w":
                board.write(ev[1], ev[2])
            elif ev[0] in ("cmd", "acmd"):
                board.sd_event(*ev)
            elif ev[0] == "wblk":
                board.write_blocks.append(ev[1])
    return True


# ---------------------------------------------------------------- SD session analysis

def crc7(data):
    crc = 0
    for byte in data:
        for i in range(7, -1, -1):
            bit = (byte >> i) & 1
            top = (crc >> 6) & 1
            crc = (crc << 1) & 0x7F
            if bit ^ top:
                crc ^= 0x09
    return crc


def sessions(board):
    """Split the SD command events into initialisation sessions.

    A session starts at a CMD0; repeated CMD0s with nothing between them belong
    to the same session (drivers retry GO_IDLE_STATE).
    """
    out = []
    cmds = [e for e in board.events if e[0] in ("cmd", "acmd")]
    for e in cmds:
        is_cmd0 = e[0] == "cmd" and e[1] == 0
        if is_cmd0 and not (out and out[-1]["cmds"][-1][:2] == ("cmd", 0)):
            out.append({"cmd0": e, "cmds": [e]})
        elif out:
            out[-1]["cmds"].append(e)
    for s in out:
        s["first_low"], s["high_start"] = select_bounds(board.frames, s["cmd0"][4] - 5)
    for a, b in zip(out, out[1:]):
        a["stop"] = b["high_start"]
    return out


def select_bounds(frames, cmd_first):
    """Start of the selected run holding the command, and of the deselected run before it."""
    first_low = max(cmd_first, 0)
    while first_low > 0 and frames[first_low - 1][2]:
        first_low -= 1
    high_start = first_low
    while high_start > 0 and not frames[high_start - 1][2]:
        high_start -= 1
    return first_low, high_start


def session_checks(board, sess, need_hcs, metric_id, check_data_rate):
    """Identification window, 74 clocks, CRC on CMD0/CMD8, HCS, data-phase bit rate."""
    frames = board.frames
    cmd0_last = sess["cmd0"][4]
    cmd0_first = cmd0_last - 5
    if cmd0_first < 0:
        board.note("card_io_ok", "CMD0 without its six command bytes")
        return
    cmd_bytes = [frames[i][1] for i in range(cmd0_first, cmd0_last + 1)]
    if cmd_bytes[5] != (crc7(cmd_bytes[:5]) << 1 | 1):
        board.note("card_io_ok", "CMD0 sent with CRC byte 0x%02x" % cmd_bytes[5])
    # deselected run before the frames that select the card for CMD0
    first_low, high_start = sess["first_low"], sess["high_start"]
    high = frames[high_start:first_low]
    if len(high) < 10:
        board.note("card_io_ok", "%d clocks with the card deselected before CMD0 (need >= 74)" % (8 * len(high)))
    for fr in high[-10:]:
        if not (fr[3] >= 100e3 and 0 < fr[4] <= 400e3):
            board.note(metric_id, "power-up clocks before CMD0 at %.0f-%.0f Hz" % (fr[3], fr[4]))
            break
    # identification ends with the R1 of the ACMD41 that precedes the first transfer-state command
    ready = None
    seen_cmd8 = None
    for e in sess["cmds"]:
        if e[0] == "cmd" and e[1] == 8:
            seen_cmd8 = e
        if e[0] == "acmd" and e[1] == 41:
            ready = e
            if need_hcs and not (e[2] >> 30 & 1):
                board.note("card_io_ok", "ACMD41 without HCS (arg 0x%08x) on a high-capacity card" % e[2])
        if e[3] == "transfer":
            break
    if seen_cmd8 is not None:
        last = seen_cmd8[4]
        b = [frames[k][1] for k in range(last - 5, last + 1)]
        if b[5] != (crc7(b[:5]) << 1 | 1):
            board.note("card_io_ok", "CMD8 sent with CRC byte 0x%02x" % b[5])
    # R1 of the successful ACMD41 comes two frames after its last command byte (QEMU ssi-sd);
    # without one, the whole session counts as identification
    end = ready[4] + 2 if ready is not None else sess.get("stop", len(frames)) - 1
    for k in range(first_low, min(end, len(frames) - 1) + 1):
        fr = frames[k]
        if fr[2] and not (fr[3] >= 100e3 and 0 < fr[4] <= 400e3):
            board.note(metric_id, "identification frame %d at %.0f-%.0f Hz" % (k, fr[3], fr[4]))
            break
    if check_data_rate:
        data_cmds = [e for e in sess["cmds"] if e[0] == "cmd" and e[1] in (17, 24)]
        if data_cmds:
            start = data_cmds[0][4] - 5
            stop = sess.get("stop", len(frames))          # up to the next session's power-up clocks
            for k in range(start, stop):
                fr = frames[k]
                if fr[2] and not (fr[3] >= 10e6 and 0 < fr[4] <= 25e6):
                    board.note("card_io_ok", "data-phase frame %d at %.0f-%.0f Hz (need 10-25 MHz)"
                               % (k, fr[3], fr[4]))
                    break


# ---------------------------------------------------------------- QEMU and UART

# QEMU resets RCC to 0x078E3AC0 (main oscillator on and selected); the silicon resets
# it to 0x078E3AD1 (datasheet, RCC register). The CPU starts in this shim, which
# writes the documented value and jumps to the reset vector, as run-sd.sh does, so
# read-modify-write code sees what it would on the board.
#   ldr r0,=0x400FE060; ldr r1,=0x078E3AD1; str r1,[r0]; movs r0,#4; ldr r0,[r0]; bx r0
RCC_SHIM = bytes.fromhex("034804490160042000680047" "00bf00bf" "60e00f40" "d13a8e07")
SHIM_ADDR = 0x2000FF00


class TraceLimit(Exception):
    pass


class Qemu:
    def __init__(self, elf, img, v1, log, errlog, timing=False, shim=None, qmp=None,
                 budget=None, trace_limit=None):
        args = [QEMU, "-M", "lm3s6965evb", "-nographic", "-monitor", "none",
                "-chardev", "stdio,id=uart,mux=off,signal=off", "-serial", "chardev:uart",
                "-device", "loader,file=%s,addr=0x%08X,force-raw=on" % (shim, SHIM_ADDR),
                "-device", "loader,addr=0x%08X,cpu-num=0" % (SHIM_ADDR | 1),
                "-kernel", elf, "-drive", "if=sd,format=raw,file=%s" % img,
                "-trace", "memory_region_ops_write", "-trace", "sdcard_normal_command",
                "-trace", "sdcard_app_command", "-trace", "sdcard_write_block", "-D", log]
        if v1:
            args += ["-global", "sd-card.spec_version=1"]
        if timing:      # one instruction per block, every block logged: instruction counts
            args += ["-singlestep", "-d", "nochain,exec", "-trace", "memory_region_ops_read"]
        if qmp:
            args += ["-qmp", "unix:%s,server=on,wait=off" % qmp]
        self.qmp_path = qmp
        self.log = log
        self.trace_limit = trace_limit
        self.deadline = time.monotonic() + budget if budget else None
        self.err = open(errlog, "wb")
        self.p = subprocess.Popen(args, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                  stderr=self.err, bufsize=0)
        self.buf = b""

    def swap_card(self, img, timeout=20):
        """Replace the card in the slot (the SD model resets on insertion)."""
        s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        s.settimeout(timeout)
        s.connect(self.qmp_path)
        f = s.makefile("rwb", buffering=0)

        def call(cmd, **arguments):
            msg = {"execute": cmd}
            if arguments:
                msg["arguments"] = arguments
            f.write(json.dumps(msg).encode() + b"\n")
            while True:
                reply = json.loads(f.readline())
                if "return" in reply:
                    return reply["return"]
                if "error" in reply:
                    raise OSError("QMP %s: %s" % (cmd, reply["error"].get("desc")))

        try:
            json.loads(f.readline())                        # greeting
            call("qmp_capabilities")
            call("blockdev-change-medium", device="sd0", filename=img, format="raw")
        finally:
            f.close()
            s.close()

    def send(self, text):
        self.p.stdin.write(text.encode() + b"\n")
        self.p.stdin.flush()

    def check_trace(self):
        if self.trace_limit is None:
            return
        try:
            size = os.path.getsize(self.log)
        except OSError:
            return
        if size > self.trace_limit:
            raise TraceLimit("run stopped: more than %d MiB of bus trace (runaway loop?)"
                             % (self.trace_limit >> 20))

    def line(self, timeout):
        end = time.monotonic() + timeout
        if self.deadline is not None and self.deadline < end:
            end, why = self.deadline, "run stopped: time budget used up"
        else:
            why = "no reply from the firmware"
        while b"\n" not in self.buf:
            left = end - time.monotonic()
            if left <= 0:
                raise TimeoutError(why)
            self.check_trace()
            r, _, _ = select.select([self.p.stdout], [], [], min(left, 0.5))
            if r:
                chunk = os.read(self.p.stdout.fileno(), 65536)
                if not chunk:
                    raise EOFError("QEMU exited")
                self.buf += chunk
        out, self.buf = self.buf.split(b"\n", 1)
        return out.decode(errors="replace").strip()

    def expect_ready(self, timeout=20):
        end = time.monotonic() + timeout
        while True:
            left = end - time.monotonic()
            if self.line(max(left, 0.01)) == "READY":
                return

    def stop(self):
        """SIGTERM first so QEMU flushes its log and the card image, then SIGKILL."""
        if self.p.poll() is None:
            self.p.terminate()
            try:
                self.p.wait(timeout=10)
            except subprocess.TimeoutExpired:
                self.p.kill()
                self.p.wait(timeout=10)
        for s in (self.p.stdin, self.p.stdout, self.err):
            try:
                s.close()
            except OSError:
                pass


def make_card(path, size, rng, lbas):
    """Sparse card image with random content in the given blocks."""
    content = {}
    with open(path, "wb") as f:
        f.truncate(size)
        for lba in lbas:
            data = bytes(rng.getrandbits(8) for _ in range(BLOCK))
            f.seek(lba * BLOCK)
            f.write(data)
            content[lba] = data
    return content


def read_card(path, lba):
    with open(path, "rb") as f:
        f.seek(lba * BLOCK)
        return f.read(BLOCK)


CARDS = {
    "SDHC": (4 << 30, False),
    "SDSC": (64 << 20, False),
    "SDV1": (32 << 20, True),
}


def pick_lbas(rng, size, n_read, n_write):
    blocks = size // BLOCK
    bands = [(1, 2048), (2048, blocks // 2), (blocks // 2, blocks - 64), (blocks - 64, blocks)]
    if blocks > (4 << 20):      # SDHC: make sure some blocks lie above the 2 GiB byte address
        bands[1] = (2048, 1 << 22)
        bands[2] = ((1 << 22) + 1, blocks - 64)
    chosen = set()
    reads, writes = [], []
    for i in range(n_read):
        lo, hi = bands[i % len(bands)]
        while True:
            lba = rng.randrange(lo, hi)
            if lba not in chosen:
                break
        chosen.add(lba)
        reads.append(lba)
    for i in range(n_write):
        lo, hi = bands[(i * 2 + 1) % len(bands)]
        while True:
            lba = rng.randrange(lo, hi)
            if lba not in chosen:
                break
        chosen.add(lba)
        writes.append(lba)
    return reads, writes


def functional_run(elf, work, name, rng, shim):
    size, v1 = CARDS[name]
    img = os.path.join(work, name + ".img")
    log = os.path.join(work, name + ".log")
    reads, writes = pick_lbas(rng, size, 4, 2)
    content = make_card(img, size, rng, reads)
    swap = None
    if name == "SDHC":      # the SDHC card is later swapped for a standard-capacity one
        swap_img = os.path.join(work, "swap.img")
        swap_lbas, _ = pick_lbas(rng, CARDS["SDSC"][0], 2, 0)
        swap = (swap_img, swap_lbas, make_card(swap_img, CARDS["SDSC"][0], rng, swap_lbas))
    board = Board(name)
    io_errors = []
    reinit = ["second initialisation not reached"] if swap else []
    q = Qemu(elf, img, v1, log, os.path.join(work, name + ".err"), shim=shim,
             qmp=os.path.join(work, name + ".qmp") if swap else None,
             budget=RUN_BUDGET, trace_limit=TRACE_LIMIT)
    try:
        q.expect_ready()
        q.send("I")
        reply = q.line(20)
        if reply != "OK " + name:
            io_errors.append("I -> %r, expected 'OK %s'" % (reply[:40], name))
        if reply.startswith("OK"):
            board.initialised = True
        for lba in reads:
            q.send("R %d" % lba)
            r = q.line(20)
            if r != "DATA " + content[lba].hex():
                io_errors.append("R %d -> wrong data (%s)" % (lba, r[:40]))
        for lba in writes:
            data = bytes(rng.getrandbits(8) for _ in range(BLOCK))
            content[lba] = data
            q.send("W %d %s" % (lba, data.hex()))
            r = q.line(20)
            if r != "OK":
                io_errors.append("W %d -> %r" % (lba, r[:40]))
            q.send("R %d" % lba)
            r = q.line(20)
            if r != "DATA " + data.hex():
                io_errors.append("read-back of block %d after W wrong (%s)" % (lba, r[:40]))
        if swap:
            reinit = []
            swap_img, swap_lbas, swap_content = swap
            q.swap_card(swap_img)
            q.send("I")
            r = q.line(20)
            if r != "OK SDSC":
                reinit.append("I after swapping in an SDSC card -> %r" % r[:40])
            for lba in swap_lbas:
                q.send("R %d" % lba)
                r = q.line(20)
                if r != "DATA " + swap_content[lba].hex():
                    reinit.append("R %d on the swapped card -> wrong data (%s)" % (lba, r[:40]))
    except (TimeoutError, EOFError, OSError, ValueError, TraceLimit) as e:
        io_errors.append("%s" % e)
        if swap:
            reinit.append(str(e))
    finally:
        q.stop()
    if not feed_file(board, log, FEED_LIMIT):
        io_errors.append("trace evaluated up to line %d only" % FEED_LIMIT)
    for lba in writes:
        if read_card(img, lba) != content[lba]:
            io_errors.append("block %d not on the card after W" % lba)
    expected = {lba * BLOCK for lba in writes}
    stray = sorted(set(board.write_blocks) - expected)
    if stray:
        io_errors.append("writes to unexpected card addresses %s" % [hex(a) for a in stray[:4]])
    if board.tx_bytes == 0:
        io_errors.append("no UART output")
    for msg in io_errors:
        board.note("card_io_ok", msg)
    ses = sessions(board)
    if not ses:
        board.note("card_io_ok", "no CMD0 seen")
        board.note("id_clock_ok", "no card initialisation seen")
    else:
        session_checks(board, ses[0], name == "SDHC", "id_clock_ok", True)
        if swap:
            if len(ses) < 2:
                board.note("reinit_ok", "second initialisation not seen")
            else:
                session_checks(board, ses[1], False, "reinit_ok", False)
    for msg in reinit:
        board.note("reinit_ok", msg)
    if not board.pll_used:
        board.note("ldo_errata_ok", "the PLL is never used")
        board.note("clock_ok", "the PLL is never used")
    elif board.ldo_at_pll != 0x1B:
        board.note("ldo_errata_ok", "LDOPCTL=0x%02x when the PLL was powered up (need 0x1B, 2.75 V)"
                   % (board.ldo_at_pll or 0))
    for path in (img, log, swap[0] if swap else None):
        try:
            if path:
                os.remove(path)
        except OSError:
            pass
    board.frames, board.events, board.write_blocks = [], [], []    # only the verdicts are kept
    return board


# ---------------------------------------------------------------- timing run

class TimingModel:
    """Instruction-accurate check of the 3-system-clock rule after RCGCn writes."""

    def __init__(self):
        self.insn = 0
        self.rcgc = {0x100: 0, 0x104: 0, 0x108: 0}
        self.pending = {}           # module base -> (insn index of the enabling write, saw sysctl read)
        self.viol = []
        self.gating = []
        self.accessed = set()       # modules accessed after their clock enable
        self.lines = 0

    def on(self, ev):
        self.lines += 1
        if ev[0] == "x":
            self.insn += 1
            return
        if ev[0] not in ("r", "w"):
            return
        addr = ev[1]
        if SYSCTL <= addr < SYSCTL + 0x1000:
            off = addr - SYSCTL
            if ev[0] == "r":
                for base in self.pending:
                    self.pending[base] = (self.pending[base][0], True)
            elif off in self.rcgc:
                new = ev[2] & ~self.rcgc[off]
                self.rcgc[off] = ev[2]
                for (o, bit), base in CLOCK_GATES.items():
                    if o == off and new >> bit & 1:
                        self.pending[base] = (self.insn, False)
            return
        mod = module_of(addr)
        if mod is None:
            return
        off, bit = GATE_OF[mod]
        if not (self.rcgc[off] >> bit & 1):
            if len(self.gating) < 4:
                self.gating.append("%s of 0x%08x before its module clock is enabled"
                                   % ("read" if ev[0] == "r" else "write", addr))
            return
        self.accessed.add(mod)
        if mod in self.pending:
            at, sysread = self.pending.pop(mod)
            between = self.insn - at - 1
            if between < 3 and not sysread:
                self.viol.append("module 0x%08x accessed %d instruction(s) after its clock enable"
                                 % (mod, between))


def timing_run(elf, work, rng, shim, max_lines=60_000_000, max_time=TIMING_BUDGET):
    size, v1 = CARDS["SDSC"]
    img = os.path.join(work, "timing.img")
    make_card(img, size, rng, [])
    fifo = os.path.join(work, "timing.fifo")
    os.mkfifo(fifo)
    model = TimingModel()
    done = threading.Event()

    def reader():
        try:
            with open(fifo, errors="replace") as f:
                for line in f:
                    ev = parse_line(line)
                    if ev is not None:
                        model.on(ev)
                    if model.lines >= max_lines or done.is_set():
                        break
        except OSError:
            pass

    t = threading.Thread(target=reader, daemon=True)
    t.start()
    q = Qemu(elf, img, v1, fifo, os.path.join(work, "timing.err"), timing=True, shim=shim,
             budget=max_time)
    note = None
    try:
        q.expect_ready(timeout=max_time / 2)
        q.send("I")
        q.line(max_time / 2)
    except (TimeoutError, EOFError, OSError) as e:
        note = "timing run: %s" % e
    finally:
        done.set()
        q.stop()
        t.join(timeout=30)
    for base, name in ((UART0, "UART0"), (SSI0, "SSI0")):
        if base not in model.accessed:
            model.viol.append("%s was never enabled and accessed in the timing run" % name)
    return model, note


# ---------------------------------------------------------------- main

def find_elf(path):
    """The built image: the path itself, or the ELF file inside it if it is a directory."""
    if os.path.isdir(path):
        for root, _, files in os.walk(path):
            for name in sorted(files):
                cand = os.path.join(root, name)
                with open(cand, "rb") as f:
                    if f.read(4) == b"\x7fELF":
                        return cand
        raise FileNotFoundError("no ELF image under %s" % path)
    if not os.path.isfile(path):
        raise FileNotFoundError("firmware image %s not found" % path)
    return path


def main():
    elf = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("FIRMWARE_ELF", "/out/firmware.elf")
    results = {m: 0 for m in METRICS}
    reasons = {m: [] for m in METRICS}
    work = tempfile.mkdtemp(prefix="sdgrade-")
    rng = random.Random(os.urandom(16))
    try:
        elf = find_elf(elf)
        shim = os.path.join(work, "rcc-reset-shim.bin")
        with open(shim, "wb") as f:
            f.write(RCC_SHIM)
        boards = [functional_run(elf, work, name, rng, shim) for name in ("SDHC", "SDSC", "SDV1")]
        model, tnote = timing_run(elf, work, rng, shim)
        for m in METRICS:
            for b in boards:
                reasons[m] += ["[%s] %s" % (b.label, v) for v in b.viol[m]]
        # rules about the SSI and the card bus only count if the firmware drove a card at all
        if not any(b.initialised for b in boards):
            for m in ("id_clock_ok", "ssi_reconfig_ok", "oled_cs_ok", "reinit_ok"):
                reasons[m].append("no card was ever initialised; rule not exercised")
        reasons["rcgc_delay_ok"] += model.viol
        reasons["card_io_ok"] += ["[timing] " + g for g in model.gating]
        if tnote:   # judged on what was traced; UART0 and SSI0 must still have been reached
            print("info: %s" % tnote, file=sys.stderr)
        for m in METRICS:
            results[m] = 0 if reasons[m] else 1
    except Exception as e:                                  # no stale passes on any failure
        for m in METRICS:
            results[m] = 0
            reasons[m].append("driver error: %r" % (e,))
    finally:
        shutil.rmtree(work, ignore_errors=True)
    for m in METRICS:
        print("%s=%d" % (m, results[m]))
    for m in METRICS:
        for r in reasons[m]:
            print("%s: %s" % (m, r), file=sys.stderr)
    sys.stdout.flush()


if __name__ == "__main__":
    main()

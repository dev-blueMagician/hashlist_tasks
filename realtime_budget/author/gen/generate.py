"""Generate the ECP-300 timing traces and the hidden ground truth.

Author-only. Simulates FreeRTOS fixed-priority scheduling on the STM32F405
(168 MHz) with three interrupts and the TMON execution monitor, and writes
trace CSVs in the format described in docs/trace_format.md.

usage: python -I generate.py PACKAGE_DIR
"""
import json
import math
import os
import random
import sys
from collections import deque

F_CPU = 168_000_000
US = 168                       # cycles per microsecond
TICK = 168_000                 # SysTick period, 1 ms
FOC_PERIOD = 8_400             # ADC trigger at 20 kHz; every capture is above 900 rpm, so RCR = 1
FOC_PHASE = 2_100

# name, FreeRTOS priority, period in ticks
TASKS = [("SpeedCtrl", 5, 1), ("CanComm", 4, 5), ("Monitor", 3, 10),
         ("Supervisor", 2, 20), ("NvM", 1, 100)]
ISR_PRIO = {"ADC_IRQHandler": 0, "CAN1_RX0_IRQHandler": 1, "SysTick_Handler": 2}
HOOKED = {"ADC_IRQHandler"}    # ISRs that call TMON_ISR_ENTER/EXIT
MATCHED_IDS = {0x18A, 0x7DF, 0x6F1}

# budgets in os_cfg.c as shipped in 3.2.0 (unchanged from 3.1)
STARTER_BUDGET_US = {"SpeedCtrl": 200, "CanComm": 470, "Monitor": 960,
                     "Supervisor": 300, "NvM": 4800}

# design maxima, microseconds (what the traces must contain, and the harness uses)
C_MAX_US = {"SpeedCtrl": 150.0, "CanComm": 380.0, "Monitor": 780.0,
            "Supervisor": 240.0, "NvM": 3900.0}
ISR_MAX_US = {"ADC_IRQHandler": 9.0, "CAN1_RX0_IRQHandler": 52.0, "SysTick_Handler": 3.0}


def cyc(x_us):
    return int(round(x_us * US))


class Scenario:
    def __init__(self, name, title, duration_ms, seed):
        self.name, self.title = name, title
        self.duration = duration_ms * TICK
        self.rng = random.Random(seed)
        self.frames = []          # (t, id)
        self.forced = {}          # (task, job index) -> cycles
        self.forced_isr = {}      # (isr, instance index) -> cycles
        self.demand_us = {}       # task -> (lo, hi)
        self.foc_us = (7.2, 8.1)
        self.systick_us = (2.2, 2.9)

    def demand(self, task, k):
        if (task, k) in self.forced:
            return self.forced[(task, k)]
        lo, hi = self.demand_us[task]
        return cyc(self.rng.uniform(lo, hi))

    def isr_exec(self, name, k, can_id=None):
        if (name, k) in self.forced_isr:
            return self.forced_isr[(name, k)]
        r = self.rng
        if name == "ADC_IRQHandler":
            return cyc(r.uniform(*self.foc_us))
        if name == "SysTick_Handler":
            return cyc(r.uniform(*self.systick_us))
        if can_id in MATCHED_IDS:
            return cyc(r.uniform(7.0, 8.5))
        return cyc(r.uniform(45.0, 51.2))


def simulate(sc):
    rng = sc.rng
    log = []
    seq = [0]

    def emit(t, ev, obj, val=""):
        log.append((t, seq[0], ev, obj, val))
        seq[0] += 1

    tasks = {n: dict(prio=p, per=per, ready=False, in_job=False, rem=0, wall=0, hooked=0,
                     job=-1, rel=0, demand=0) for n, p, per in TASKS}
    stats = {n: dict(net=[], tmon=[], resp=[]) for n in tasks}
    isr_stats = {n: dict(exec=[], arrivals=[]) for n in ISR_PRIO}
    stack = []
    pending = {n: deque() for n in ISR_PRIO}
    isr_count = {n: 0 for n in ISR_PRIO}
    current = ["IDLE"]
    tick = [0]
    t = 0
    foc_next = FOC_PHASE
    tick_next = 0
    frames = sorted(sc.frames)
    fi = 0
    kicks = []

    def isr_start(name, info, now):
        k = isr_count[name]
        isr_count[name] += 1
        ex = sc.isr_exec(name, k, info)
        stack.append(dict(name=name, rem=ex, total=ex, nested=0, info=info))
        isr_stats[name]["exec"].append(ex)
        emit(now, "ISR_ENTER", name, ("0x%03X" % info) if name == "CAN1_RX0_IRQHandler" else "")

    def isr_arrive(name, info, now):
        isr_stats[name]["arrivals"].append(now)
        if not stack or ISR_PRIO[name] < ISR_PRIO[stack[-1]["name"]]:
            isr_start(name, info, now)
        else:
            pending[name].append(info)

    def start_pending(now):
        best = None
        for n in pending:
            if pending[n] and (best is None or ISR_PRIO[n] < ISR_PRIO[best]):
                best = n
        if best is not None and (not stack or ISR_PRIO[best] < ISR_PRIO[stack[-1]["name"]]):
            isr_start(best, pending[best].popleft(), now)
            return True
        return False

    def schedule(now):
        ready = [n for n, s in tasks.items() if s["ready"]]
        nxt = max(ready, key=lambda n: tasks[n]["prio"]) if ready else "IDLE"
        if nxt == current[0]:
            return
        emit(now, "TASK_SWITCH_OUT", current[0])
        emit(now, "TASK_SWITCH_IN", nxt)
        current[0] = nxt
        if nxt != "IDLE" and not tasks[nxt]["in_job"]:
            s = tasks[nxt]
            s["in_job"] = True
            s["job"] += 1
            s["demand"] = s["rem"] = sc.demand(nxt, s["job"])
            s["wall"] = s["hooked"] = 0
            emit(now, "JOB_START", nxt)

    def advance(dt):
        if dt <= 0:
            return
        cur = tasks.get(current[0])
        injob = cur is not None and cur["in_job"]
        if injob:
            cur["wall"] += dt
        if stack:
            top = stack[-1]
            top["rem"] -= dt
            for below in stack[:-1]:
                below["nested"] += dt
            if top["name"] in HOOKED and injob:
                cur["hooked"] += dt
        elif injob:
            cur["rem"] -= dt

    emit(0, "TASK_SWITCH_IN", "IDLE")
    end = sc.duration
    while True:
        ta = min(foc_next, tick_next, frames[fi][0] if fi < len(frames) else math.inf)
        cur = tasks.get(current[0])
        if stack:
            tc = t + stack[-1]["rem"]
        elif cur is not None and cur["in_job"]:
            tc = t + cur["rem"]
        else:
            tc = math.inf
        tn = min(ta, tc)
        if tn >= end:
            break
        advance(tn - t)
        t = tn
        if tc == tn:
            if stack:
                top = stack.pop()
                if top["name"] == "SysTick_Handler":
                    tick[0] += 1
                    n_tick = tick[0] - 1
                    for n, s in tasks.items():
                        if n_tick % s["per"] == 0:
                            if s["ready"]:
                                raise RuntimeError("%s overran its period at tick %d" % (n, n_tick))
                            s["ready"] = True
                            s["rel"] = top["info"]
                            emit(t, "TASK_READY", n)
                emit(t, "ISR_EXIT", top["name"])
                if not start_pending(t) and not stack:
                    schedule(t)
            else:
                s = cur
                if current[0] == "Supervisor":
                    emit(t, "WDG_KICK", "Supervisor")
                    kicks.append(t)
                emit(t, "JOB_END", current[0])
                measured = s["wall"] - s["hooked"]
                emit(t, "TMON", current[0], str(measured))
                st = stats[current[0]]
                st["net"].append(s["demand"])
                st["tmon"].append(measured)
                st["resp"].append(t - s["rel"])
                s["in_job"] = False
                s["ready"] = False
                schedule(t)
            continue
        # arrivals due now
        if foc_next == t:
            foc_next += FOC_PERIOD
            isr_arrive("ADC_IRQHandler", None, t)
        if tick_next == t:
            tick_next += TICK
            isr_arrive("SysTick_Handler", t, t)    # info = release instant of this tick
        while fi < len(frames) and frames[fi][0] == t:
            isr_arrive("CAN1_RX0_IRQHandler", frames[fi][1], t)
            fi += 1
    return log, stats, isr_stats, kicks


def can_frames_bench(sc, dur_ms):
    r = sc.rng
    t_ms = 3.3
    while t_ms < dur_ms - 1:
        sc.frames.append((int((t_ms + r.uniform(-0.15, 0.15)) * TICK), 0x18A))
        t_ms += 10.0


def can_frames_service(sc, dur_ms):
    """ECM reprogramming at the workshop: tester 0x7E0 consecutive frames at
    STmin 1 ms, ECM 0x7E8 flow control and responses, vehicle setpoint 0x18A."""
    r = sc.rng
    can_frames_bench(sc, dur_ms)
    t = 12.0
    while t < dur_ms - 2:
        # one TransferData request: FF, FC from the ECM, then consecutive frames
        sc.frames.append((int(t * TICK), 0x7E0))
        t += r.uniform(0.75, 0.95)
        sc.frames.append((int(t * TICK), 0x7E8))
        t += r.uniform(1.05, 1.25)
        n_cf = r.randint(150, 220)
        for _ in range(n_cf):
            if t >= dur_ms - 2:
                break
            sc.frames.append((int(t * TICK), 0x7E0))
            t += r.uniform(1.02, 1.30)
        # ECM writes flash, then answers 0x76
        t += r.uniform(18.0, 26.0)
        if t < dur_ms - 2:
            sc.frames.append((int(t * TICK), 0x7E8))
        t += r.uniform(1.4, 2.2)
    sc.frames.append((int(437.6 * TICK), 0x7DF))   # TesterPresent, functional


def serialize(sc):
    """Put the requested frames on a 500 kbit/s bus: one frame at a time, each
    8-byte frame 236-262 us long with stuffing and intermission, the receive
    interrupt at its end. Consecutive receptions in these captures stay at
    least 0.6 ms apart, so the "min gap seen" of a trace is nowhere near the
    bus limit and cannot stand in for the VN-07 derivation of T_k."""
    r = sc.rng
    out = []
    last_end = -10 ** 12
    for t, fid in sorted(sc.frames):
        length = int(r.uniform(236.0, 262.0) * US)
        start = max(t, last_end + int(0.6 * TICK) - length)
        end = start + length
        last_end = end
        out.append((end, fid))
    sc.frames = sorted(out)


def build_scenarios():
    out = []
    a = Scenario("bench_nominal_2400rpm", "bench, 2400 rpm, 13.6 V, CAN from vehicle simulator", 500, 3201)
    a.demand_us = {"SpeedCtrl": (110, 135), "CanComm": (240, 290), "Monitor": (600, 690),
                   "Supervisor": (180, 210), "NvM": (2000, 2600)}
    can_frames_bench(a, 500)
    out.append(a)

    b = Scenario("bench_maxspeed_5200rpm", "bench, 5200 rpm (field weakening), 12.2 V, CAN from vehicle simulator", 500, 3202)
    b.demand_us = {"SpeedCtrl": (128, 146), "CanComm": (240, 290), "Monitor": (610, 700),
                   "Supervisor": (180, 210), "NvM": (2000, 2600)}
    b.foc_us = (7.9, 8.85)
    b.forced[("SpeedCtrl", 317)] = cyc(C_MAX_US["SpeedCtrl"])
    for k in (0, 10, 20, 30, 40):           # derating table walk every 100 ms
        b.forced[("Monitor", k)] = cyc(b.rng.uniform(745, 770))
    b.forced[("Monitor", 30)] = cyc(C_MAX_US["Monitor"])
    b.forced_isr[("ADC_IRQHandler", 4817)] = cyc(ISR_MAX_US["ADC_IRQHandler"])
    b.forced_isr[("ADC_IRQHandler", 9133)] = cyc(8.95)
    b.forced_isr[("SysTick_Handler", 211)] = cyc(ISR_MAX_US["SysTick_Handler"])
    can_frames_bench(b, 500)
    out.append(b)

    c = Scenario("service_bay_ecm_reflash", "workshop, ECM reprogramming over the vehicle bus, pump after-run 1800 rpm, 13.9 V", 800, 3203)
    c.demand_us = {"SpeedCtrl": (110, 128), "CanComm": (270, 345), "Monitor": (600, 690),
                   "Supervisor": (190, 228), "NvM": (2000, 2600)}
    c.forced[("CanComm", 97)] = cyc(C_MAX_US["CanComm"])
    c.forced[("Supervisor", 23)] = cyc(C_MAX_US["Supervisor"])
    c.forced[("NvM", 4)] = cyc(C_MAX_US["NvM"])          # freeze frame for U0100 (lost ECM)
    c.forced[("NvM", 5)] = cyc(3410)
    c.forced[("NvM", 6)] = cyc(3380)
    can_frames_service(c, 800)
    # the slowest unmatched frame in the capture
    n_unmatched = 0
    for k, (t, fid) in enumerate(sorted(c.frames)):
        if fid not in MATCHED_IDS:
            n_unmatched += 1
    c.worst_can_index = None
    out.append(c)
    return out


def force_worst_can(sc, log_pass=None):
    """Make one unmatched frame in the capture take the full 52.0 us."""
    frames = sorted(sc.frames)
    idx = [i for i, (_, fid) in enumerate(frames) if fid not in MATCHED_IDS]
    k = idx[len(idx) // 2]
    sc.forced_isr[("CAN1_RX0_IRQHandler", k)] = cyc(ISR_MAX_US["CAN1_RX0_IRQHandler"])
    sc.forced_isr[("CAN1_RX0_IRQHandler", idx[len(idx) // 3])] = cyc(51.7)
    sc.forced_isr[("SysTick_Handler", 377)] = cyc(ISR_MAX_US["SysTick_Handler"])


HEADER = """# ECP-300 coolant pump controller - TMON/trace recorder export
# software 3.2.0 (build 3.2.0+417), target STM32F405RG, FreeRTOS 10.5.1
# scenario: {title}
# capture length: {ms} ms, recorder buffer in CCM RAM, exported with trace_export 1.4
# timestamp: DWT_CYCCNT of the CPU (core clock cycles), as read by the recorder
# event,object,value: see docs/trace_format.md
"""


def write_trace(path, sc, log):
    base = sc.rng.randrange(1_200_000_000, 1_900_000_000)
    log.sort(key=lambda e: (e[0], e[1]))
    with open(path, "w", newline="\n", encoding="utf-8") as f:
        f.write(HEADER.format(title=sc.title, ms=sc.duration // TICK))
        f.write("timestamp,event,object,value\n")
        for t, _, ev, obj, val in log:
            f.write("%d,%s,%s,%s\n" % (t + base, ev, obj, val))
    return base


def main():
    pkg = sys.argv[1]
    tdir = os.path.join(pkg, "environment", "data", "traces")
    os.makedirs(tdir, exist_ok=True)
    truth = dict(C_MAX_US=C_MAX_US, ISR_MAX_US=ISR_MAX_US, traces={})
    obs_c = {n: 0 for n in C_MAX_US}
    obs_isr = {n: 0 for n in ISR_MAX_US}
    obs_tmon = {n: 0 for n in C_MAX_US}
    for sc in build_scenarios():
        serialize(sc)
        if sc.name.startswith("service"):
            force_worst_can(sc)
        log, stats, isr_stats, kicks = simulate(sc)
        path = os.path.join(tdir, sc.name + ".csv")
        write_trace(path, sc, log)
        tr = {}
        for n, st in stats.items():
            tr[n] = dict(jobs=len(st["net"]), net_max_us=max(st["net"]) / US,
                         tmon_max_us=max(st["tmon"]) / US, resp_max_us=max(st["resp"]) / US)
            obs_c[n] = max(obs_c[n], max(st["net"]) / US)
            obs_tmon[n] = max(obs_tmon[n], max(st["tmon"]) / US)
            over = [m / US for m in st["tmon"] if m > STARTER_BUDGET_US[n] * US]
            if over:
                raise SystemExit("%s: %s exceeds its 3.2.0 budget in the capture: %s" % (sc.name, n, over[:5]))
        for n, st in isr_stats.items():
            arr = st["arrivals"]
            gaps = [b - a for a, b in zip(arr, arr[1:])]
            tr[n] = dict(count=len(st["exec"]), exec_max_us=max(st["exec"]) / US,
                         min_gap_us=(min(gaps) / US) if gaps else None)
            obs_isr[n] = max(obs_isr[n], max(st["exec"]) / US)
        kg = [b - a for a, b in zip(kicks, kicks[1:])]
        tr["kick_interval_max_us"] = max(kg) / US
        tr["size_bytes"] = os.path.getsize(path)
        truth["traces"][sc.name] = tr
        print("%-26s %8d bytes" % (sc.name, tr["size_bytes"]))
    for n in C_MAX_US:
        if abs(obs_c[n] - C_MAX_US[n]) > 1e-9:
            raise SystemExit("net maximum of %s is %.3f us, design says %.3f" % (n, obs_c[n], C_MAX_US[n]))
    for n in ISR_MAX_US:
        if abs(obs_isr[n] - ISR_MAX_US[n]) > 1e-9:
            raise SystemExit("ISR maximum of %s is %.3f us, design says %.3f" % (n, obs_isr[n], ISR_MAX_US[n]))
    truth["observed_tmon_max_us"] = obs_tmon
    with open(os.path.join(os.path.dirname(__file__), "truth.json"), "w") as f:
        json.dump(truth, f, indent=2)
    print(json.dumps(truth["traces"], indent=1))
    print("observed TMON maxima:", obs_tmon)


if __name__ == "__main__":
    main()

"""Python mirror of verifier/harness.c, for checking answers on the author's PC.

usage: python -I score.py SOLUTION.c [...]
Prints the metrics harness.c would print, and the reward under the scored
steps in author/scored-steps.json (if present).
"""
import json
import math
import os
import re
import sys

LABEL = ["speedctrl", "cancomm", "monitor", "supervisor", "nvm"]
PERIOD = [1000.0, 5000.0, 10000.0, 20000.0, 100000.0]
DEADLINE = PERIOD[:]
WCET = [150.0, 380.0, 780.0, 240.0, 3900.0]
ISR_T = [50.0, 222.0, 1000.0]
ISR_C = [9.0, 52.0, 3.0]
ISR_CHARGED = [False, True, True]
LSI_MIN, LSI_MAX = 17000.0, 47000.0


def monitored(c, isr_t=ISR_T, isr_c=ISR_C, charged=ISR_CHARGED):
    w = c
    while True:
        allv = c + sum(math.ceil(w / t) * k for t, k in zip(isr_t, isr_c))
        ch = c + sum(math.ceil(w / t) * k for t, k, g in zip(isr_t, isr_c, charged) if g)
        if allv == w:
            return ch
        w = allv


def response(i, budget, prio, limit, isr_t=ISR_T, isr_c=ISR_C, charged=ISR_CHARGED, period=PERIOD):
    r = budget[i]
    while True:
        nxt = budget[i] + sum(math.ceil(r / period[j]) * budget[j]
                              for j in range(len(budget)) if j != i and prio[j] >= prio[i])
        nxt += sum(math.ceil(r / t) * k for t, k, g in zip(isr_t, isr_c, charged) if not g)
        if nxt == r:
            return r
        if nxt > limit:
            return math.inf
        r = nxt


def metrics(budget, prio, pr, rl):
    out = {"config_ok": 1}
    m = [monitored(c) for c in WCET]
    for i in range(5):
        out["budget_%s_ratio" % LABEL[i]] = round(budget[i] / m[i], 4) if budget[i] > 0 else 0.0
    ok = all(b > 0 for b in budget)
    r = [response(i, budget, prio, 4 * PERIOD[4]) if ok else math.inf for i in range(5)]
    out["deadlines_met"] = sum(1 for i in range(5) if r[i] <= DEADLINE[i])
    ticks = (4 << min(pr, 6)) * (rl + 1)
    kick = PERIOD[3] + r[3]
    out["wdg_margin_us"] = round(ticks / LSI_MAX * 1e6 - kick, 1) if math.isfinite(kick) else -1e9
    out["wdg_max_timeout_ms"] = round(ticks / LSI_MIN * 1e3, 2)
    out["info_m"] = m
    out["info_r"] = r
    out["info_kick_us"] = kick
    out["info_ticks"] = ticks
    return out


ROW = re.compile(r"\[TASK_(\w+)\]\s*=\s*\{\s*\"[^\"]*\"\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\}")


def parse(path):
    src = open(path, encoding="utf-8").read()
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
    order = ["SPEEDCTRL", "CANCOMM", "MONITOR", "SUPERVISOR", "NVM"]
    rows = {m.group(1): m for m in ROW.finditer(src)}
    budget = [float(rows[k].group(5)) for k in order]
    prio = [int(rows[k].group(2)) for k in order]
    pr = int(re.search(r"\.prescaler\s*=\s*(\d+)", src).group(1))
    rl = int(re.search(r"\.reload\s*=\s*(\d+)", src).group(1))
    return budget, prio, pr, rl


def reward(mx, steps):
    got = tot = 0
    for s in steps:
        v = mx.get(s["field"])
        hit = v is not None and s["low"] <= v <= s["high"]
        got += s["worth"] if hit else 0
        tot += s["worth"]
    return got / tot


def main():
    steps = None
    sp = os.path.join(os.path.dirname(__file__), "..", "scored-steps.json")
    if os.path.exists(sp):
        steps = json.load(open(sp, encoding="utf-8")).get("steps")
    for path in sys.argv[1:]:
        mx = metrics(*parse(path))
        line = " ".join("%s=%s" % (k, v) for k, v in mx.items() if not k.startswith("info"))
        print(os.path.basename(path), line)
        print("   M=", [round(x, 1) for x in mx["info_m"]], "R=", [round(x, 1) for x in mx["info_r"]],
              "kick=", round(mx["info_kick_us"], 1), "ticks=", mx["info_ticks"])
        if steps:
            print("   reward=%.3f" % reward(mx, steps))


if __name__ == "__main__":
    main()

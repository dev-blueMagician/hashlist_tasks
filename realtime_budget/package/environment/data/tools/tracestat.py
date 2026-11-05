#!/usr/bin/env python3
"""tracestat - summary of an ECP-300 trace recorder export (docs/trace_format.md).

usage: python3 tracestat.py TRACE.csv [--clock HZ]

Per task: jobs, net execution time (CPU time of the task itself, interrupt
time removed), TMON measurement, response time (TASK_READY to JOB_END).
Per interrupt: count, execution time without nested interrupts, shortest
time between two entries seen in this capture.
"""
import argparse
import csv
import sys


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("trace")
    ap.add_argument("--clock", type=float, default=168e6, help="core clock in Hz (default 168 MHz)")
    a = ap.parse_args()
    us = 1e6 / a.clock

    tasks = {}
    isrs = {}
    stack = []            # [name, enter_t, nested_cycles]
    cur = None            # task switched in
    seg_start = None      # start of the current switched-in segment of a job
    top_isr_start = None  # start of the outermost active handler
    kicks = []

    def task(n):
        return tasks.setdefault(n, dict(active=False, wall=0, isr=0, ready=None,
                                        net=[], tmon=[], resp=[]))

    with open(a.trace, newline="") as f:
        rows = csv.reader(line for line in f if not line.startswith("#"))
        next(rows)
        for ts, ev, obj, val in rows:
            t = int(ts)
            if ev == "ISR_ENTER":
                if not stack:
                    top_isr_start = t
                stack.append([obj, t, 0])
                s = isrs.setdefault(obj, dict(exec=[], enter=[]))
                s["enter"].append(t)
            elif ev == "ISR_EXIT":
                name, t0, nested = stack.pop()
                isrs[name]["exec"].append(t - t0 - nested)
                if stack:
                    stack[-1][2] += t - t0
                else:
                    if cur and tasks[cur]["active"]:
                        tasks[cur]["isr"] += t - top_isr_start
            elif ev == "TASK_READY":
                task(obj)["ready"] = t
            elif ev == "TASK_SWITCH_IN":
                cur = obj if obj != "IDLE" else None
                if cur and task(cur)["active"]:
                    seg_start = t
            elif ev == "TASK_SWITCH_OUT":
                if cur and tasks[cur]["active"]:
                    tasks[cur]["wall"] += t - seg_start
                cur = None
            elif ev == "JOB_START":
                s = task(obj)
                s.update(active=True, wall=0, isr=0)
                seg_start = t
            elif ev == "JOB_END":
                s = tasks[obj]
                s["wall"] += t - seg_start
                s["active"] = False
                s["net"].append(s["wall"] - s["isr"])
                if s["ready"] is not None:
                    s["resp"].append(t - s["ready"])
            elif ev == "TMON":
                tasks[obj]["tmon"].append(int(val))
            elif ev == "WDG_KICK":
                kicks.append(t)

    print("%-11s %5s %10s %10s %10s %10s" % ("task", "jobs", "net max", "net mean", "TMON max", "resp max"))
    for n, s in tasks.items():
        if not s["net"]:
            continue
        print("%-11s %5d %8.1fus %8.1fus %8.1fus %8.1fus" % (
            n, len(s["net"]), max(s["net"]) * us, sum(s["net"]) / len(s["net"]) * us,
            max(s["tmon"]) * us, max(s["resp"]) * us if s["resp"] else float("nan")))
    print()
    print("%-20s %6s %10s %10s %14s" % ("interrupt", "count", "exec max", "exec mean", "min gap seen"))
    for n, s in isrs.items():
        e = s["exec"]
        gaps = [b - x for x, b in zip(s["enter"], s["enter"][1:])]
        print("%-20s %6d %8.2fus %8.2fus %12.1fus" % (
            n, len(e), max(e) * us, sum(e) / len(e) * us, min(gaps) * us if gaps else float("nan")))
    if len(kicks) > 1:
        g = [b - x for x, b in zip(kicks, kicks[1:])]
        print()
        print("IWDG refresh interval: max %.1f us, min %.1f us (%d refreshes)" % (max(g) * us, min(g) * us, len(kicks)))


if __name__ == "__main__":
    sys.exit(main())

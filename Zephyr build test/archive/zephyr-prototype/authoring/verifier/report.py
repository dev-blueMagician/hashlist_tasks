"""Trusted protocol parser and deterministic partial-credit scoring."""
import re

CASES = {
    "empty_first": [],
    "single": [17],
    "partial": [3, 1, 4, 1, 5, 9],
    "full_wrap": [0xFFFFFFFF, 2, 0x80000000, 0, 73, 0xFFFFFFFE, 19, 31],
    "repeat": [99, 0, 7],
    "empty_again": [],
}
WEIGHTS = {
    "build": 2,
    "boot": 1,
    "completion": 1,
    "counts": 3,
    "sums": 3,
    "fifo_order": 3,
    "drained": 3,
    "return_codes": 1,
}
BEGIN = "ZEPHYR_SMOKE_BEGIN v1"
END = "ZEPHYR_SMOKE_END v1"
RECORD = re.compile(
    r"CASE ([a-z_]+) count=(\d+) sum=(\d+) order=(\d+) remaining=(\d+) rc=(-?\d+)"
)
FATAL = re.compile(r"ASSERTION FAIL|ZEPHYR FATAL ERROR|Kernel panic|ZEPHYR_SMOKE_SETUP_ERROR", re.I)


def expected(values):
    order = 0
    for value in values:
        order = (order * 33 + value) & 0xFFFFFFFF
    return {"count": len(values), "sum": sum(values) & 0xFFFFFFFF,
            "order": order, "remaining": 0, "rc": 0}


def evaluate_runtime(output):
    """Reject duplicate, missing, malformed, reordered or out-of-frame records."""
    lines = [line.strip() for line in output.splitlines()]
    records = {}
    protocol = [line for line in lines if line.startswith(("CASE ", "ZEPHYR_SMOKE_"))]
    begin_ok = lines.count(BEGIN) == 1
    end_ok = lines.count(END) == 1
    valid = begin_ok and end_ok and not FATAL.search(output)
    valid = valid and len(protocol) == len(CASES) + 2
    valid = valid and protocol[0:1] == [BEGIN] and protocol[-1:] == [END]
    if valid:
        for name, line in zip(CASES, protocol[1:-1]):
            match = RECORD.fullmatch(line)
            if not match or match[1] != name:
                valid = False
                break
            values = [int(item) for item in match.groups()[1:]]
            if any(value > 0xFFFFFFFF for value in values[:-1]):
                valid = False
                break
            records[name] = dict(zip(("count", "sum", "order", "remaining", "rc"), values))
    checks = {"boot": begin_ok, "completion": bool(valid)}
    for check, field in (("counts", "count"), ("sums", "sum"),
                         ("fifo_order", "order"), ("drained", "remaining"),
                         ("return_codes", "rc")):
        checks[check] = bool(valid) and all(
            records[name][field] == expected(values)[field]
            for name, values in CASES.items()
        )
    return checks, records


def make_report(checks, category=None, *, details=None, skipped=()):
    full = {name: bool(checks.get(name, False)) for name in WEIGHTS}
    strict = all(full.values())
    score = sum(WEIGHTS[name] for name, passed in full.items() if passed) / sum(WEIGHTS.values())
    return {
        "reward": score,
        "strict_pass": strict,
        "failure_category": None if strict else (category or "wrong_answer"),
        "counters": {"passed": sum(full.values()), "total": len(full)},
        "info": {
            "checks": full,
            "failed": [name for name, passed in full.items() if not passed],
            "skipped": list(skipped),
            "details": details or {},
        },
    }


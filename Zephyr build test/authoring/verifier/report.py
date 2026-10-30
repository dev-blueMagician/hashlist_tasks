"""Binary UART protocol and independently calculated grading expectations."""
import struct

BANNER = b"FIRMWARE_READY v1\n"
FRAME = struct.Struct("<BBB I I BB")
CASES = (
    ("empty_first", 0, []),
    ("single", 1, [0x01000001]),
    ("partial", 2, [3, 1, 4, 1, 5, 9]),
    ("full_wrap", 127, [0xFFFFFFFF, 2, 0x80000000, 0, 73, 0xFFFFFFFE, 19, 31]),
    ("repeat", 128, [99, 0, 7]),
    ("empty_again", 255, []),
)
WEIGHTS = {"build": 2, "boot": 1, "completion": 1, "counts": 3,
           "sums": 3, "fifo_order": 3, "drained": 3, "return_codes": 1}


def requests():
    return b"".join(bytes((seq, len(values))) + b"".join(struct.pack("<I", v) for v in values)
                    for _, seq, values in CASES)


def expected(values):
    order = 0
    for value in values:
        order = (order * 33 + value) & 0xFFFFFFFF
    return {"count": len(values), "sum": sum(values) & 0xFFFFFFFF,
            "order": order, "remaining": 0, "rc": 0}


def evaluate_uart(output):
    boot = output.startswith(BANNER)
    valid = boot and len(output) == len(BANNER) + FRAME.size * len(CASES)
    records = {}
    if valid:
        for index, (name, sequence, _) in enumerate(CASES):
            frame = FRAME.unpack_from(output, len(BANNER) + index * FRAME.size)
            if frame[0] != 0xA5 or frame[1] != sequence:
                valid = False
                break
            records[name] = dict(zip(("count", "sum", "order", "remaining", "rc"), frame[2:]))
    checks = {"boot": boot, "completion": valid}
    for check, field in (("counts", "count"), ("sums", "sum"),
                         ("fifo_order", "order"), ("drained", "remaining"),
                         ("return_codes", "rc")):
        checks[check] = valid and all(records[name][field] == expected(values)[field]
                                     for name, _, values in CASES)
    return checks, records


def make_report(checks, category=None, *, details=None, skipped=()):
    full = {name: bool(checks.get(name, False)) for name in WEIGHTS}
    strict = all(full.values())
    return {
        "reward": sum(WEIGHTS[name] for name, passed in full.items() if passed) / sum(WEIGHTS.values()),
        "strict_pass": strict,
        "failure_category": None if strict else (category or "wrong_answer"),
        "counters": {"passed": sum(full.values()), "total": len(full)},
        "info": {"checks": full, "failed": [name for name, passed in full.items() if not passed],
                 "skipped": list(skipped), "details": details or {}},
    }


"""Send UART batches to the compiled firmware and print the measured results."""
import struct
import sys

BANNER = b"FIRMWARE_READY v1\n"
FRAME = struct.Struct("<BBB I I BB")
CASES = (
    (0, []),
    (1, [0x01000001]),
    (2, [3, 1, 4, 1, 5, 9]),
    (127, [0xFFFFFFFF, 2, 0x80000000, 0, 73, 0xFFFFFFFE, 19, 31]),
    (128, [99, 0, 7]),
    (255, []),
)


def request_bytes():
    return b"".join(bytes((seq, len(values))) + b"".join(struct.pack("<I", v) for v in values)
                    for seq, values in CASES)


def measure(got):
    metrics = dict.fromkeys(("build", "boot", "completion", "counts", "sums",
                            "fifo_order", "drained", "return_codes"), 0)
    # The platform builds the answer before invoking this driver with an ELF.
    metrics["build"] = 1
    metrics["boot"] = int(got.startswith(BANNER))
    if not metrics["boot"] or len(got) != len(BANNER) + FRAME.size * len(CASES):
        return metrics
    frames = []
    for i, (seq, values) in enumerate(CASES):
        frame = FRAME.unpack_from(got, len(BANNER) + i * FRAME.size)
        if frame[0] != 0xA5 or frame[1] != seq:
            return metrics
        frames.append((frame, values))
    metrics["completion"] = 1
    metrics["counts"] = int(all(frame[2] == len(values) for frame, values in frames))
    metrics["sums"] = int(all(frame[3] == sum(values) & 0xFFFFFFFF for frame, values in frames))
    order_ok = True
    for frame, values in frames:
        order = 0
        for value in values:
            order = (order * 33 + value) & 0xFFFFFFFF
        order_ok = order_ok and frame[4] == order
    metrics["fifo_order"] = int(order_ok)
    metrics["drained"] = int(all(frame[5] == 0 for frame, _ in frames))
    metrics["return_codes"] = int(all(frame[6] == 0 for frame, _ in frames))
    return metrics


def main(elf, board_fn=None):
    if board_fn is None:
        from board import board
        board_fn = board
    got = board_fn(elf, request_bytes(), expected=len(BANNER) + FRAME.size * len(CASES))
    for label, value in measure(got).items():
        print(f"{label}={value}")


if __name__ == "__main__":
    main(sys.argv[1])

<!-- Preserve the platform-generated canary sentence here when importing. -->
<!-- Preserve the platform-generated canary GUID here when importing. -->

Repair the queue drain in `/app/data/task/zephyr_smoke/src/pipeline.c`.

This is an internal build-and-run check for the pre-created Zephyr environment.
The starter builds, but leaves one message in every nonempty queue. Implement
`pipeline_drain` according to `src/pipeline.h`:

- Consume all queued `uint32_t` messages in FIFO order, using Zephyr's message
  queue API. No other thread changes the queue during the call.
- Reset the result on each invocation, including when the queue is empty.
- Report the number consumed, their sum, and their rolling order checksum.
  Sum and checksum wrap modulo 2^32. Start the order checksum at zero and use
  `order = order * 33U + value` for each consumed value.
- Return zero when the queue is drained. Return an unexpected receive error
  rather than reporting success. An empty queue is a normal completion.
- Do not wait for future messages. Do not print from `pipeline_drain`.

Keep the function signature and modify only `src/pipeline.c`. The other files
are a buildable local example and will be replaced by the grader's trusted
harness. The grader tests empty, single-item, partially occupied, and full
queues, repeated calls, different values, and unsigned arithmetic wraparound.
Do not assume the example values are the only inputs.

The supplied environment is Zephyr v4.4.2 with Zephyr SDK 1.0.1. Internet access
is disabled; use the installed tools and source tree. Do not update west
modules, install packages, or modify the shared environment.

From a configured Zephyr shell, use a new task-local build directory:

```sh
west build -b qemu_cortex_m3 -d /app/data/task/build-local /app/data/task/zephyr_smoke
west build -d /app/data/task/build-local -t run
```

The example prints `ZEPHYR_SMOKE_BEGIN v1`, two `CASE` lines, then
`ZEPHYR_SMOKE_END v1`. QEMU can remain running after the last line; exit the
interactive run with Ctrl+A, then X. Submit the repaired source file at the
original path. A prebuilt ELF or a written explanation is not the deliverable.


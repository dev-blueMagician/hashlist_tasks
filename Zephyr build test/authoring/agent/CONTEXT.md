This is a small Cortex-M3 firmware fixture running on QEMU's `lm3s6965evb`.
It receives batches of up to eight uint32 values over UART and returns a summary for each batch.
`/app/data/task/firmware/pipeline.c` contains the queue, the drain routine, and the UART loop.
It defines `app_main()` so the answer can be compiled as a single source file with the supplied startup.

The environment supplies `/app/data/start.c`, `link.ld`, `uart.h`, and `run.sh`.
The startup calls `app_main()`. These four files are locked.

Build with the installed ARM compiler:

```sh
sh /app/data/task/build.sh
```

The ELF is written to `/app/data/task/build/firmware.elf`. To launch it:

```sh
sh /app/data/run.sh /app/data/task/build/firmware.elf
```

The firmware prints `FIRMWARE_READY v1`, then waits for binary UART requests.
A terminal run will remain open while it waits. Internet access is disabled.

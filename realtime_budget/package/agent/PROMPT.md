Since software 3.2.0 went out to the fleet in July, ECP-300 coolant pumps reset now and then: the pump stops for about 300 ms and starts again. The pumps report two kinds of reset, TMON budget overruns and independent watchdog (IWDG) resets. No such reset was reported on 3.1.0.

The material is in `/app/data`:

- `field/`: the fleet reset log and a description of its columns
- `traces/`: the three reference traces of 3.2.0 (bench at nominal speed, bench at maximum speed, a workshop visit with ECM reprogramming); `tools/tracestat.py` summarises a trace
- `src/`: the timing-related sources of 3.2.0
- `docs/`: TAG-01 timing analysis guideline, SRS-ECP300 timing requirements, VN-07 network specification excerpt, release notes, trace format

The STM32F405 datasheet and the RM0090 reference manual are in `/app/files`.

The code is frozen for the 3.2.1 maintenance release. Only the timing configuration `src/os_cfg.c` may change: task budgets, task priorities, and the IWDG prescaler and reload. Periods and deadlines are fixed by the SRS. Write the corrected file to `/app/solution.c`, which starts as a copy of the 3.2.0 `os_cfg.c`. It has to meet the timing and watchdog requirements of SRS-ECP300.

Keep `/app/solution.c` a configuration file like the original, with `os_cfg.h` as its only project header. It must compile with:

```
gcc -O2 -std=c11 -I/app/data/src -c /app/solution.c
```

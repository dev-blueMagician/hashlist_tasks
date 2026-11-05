# Trace recorder export format

The ECP-300 trace recorder (`trace_rec.c`, `trace_hooks.c`) writes events into a ring buffer in CCM RAM. `trace_export` reads the buffer over SWD and writes one CSV file per capture.

Lines starting with `#` are comments. The header line is `timestamp,event,object,value`.

- `timestamp`: DWT_CYCCNT, the CPU cycle counter, read when the event is recorded.
- Events are in the order they were recorded; events with the same timestamp keep that order.

| event | object | value | meaning |
| --- | --- | --- | --- |
| `ISR_ENTER` | handler name | CAN ID for `CAN1_RX0_IRQHandler`, else empty | handler starts (for CAN: per frame taken from the FIFO) |
| `ISR_EXIT` | handler name | | handler done |
| `TASK_READY` | task | | task released by the tick (recorded inside `SysTick_Handler`) |
| `TASK_SWITCH_OUT` | task or `IDLE` | | task leaves the CPU |
| `TASK_SWITCH_IN` | task or `IDLE` | | task gets the CPU |
| `JOB_START` | task | | `tmon_job_begin()` |
| `JOB_END` | task | | `tmon_job_end()` |
| `TMON` | task | cycles | execution time TMON measured for the job that just ended |
| `WDG_KICK` | `Supervisor` | | IWDG refresh |

Interrupts nest: an `ISR_ENTER` can follow another `ISR_ENTER` before its `ISR_EXIT` (NVIC priorities: ADC 1, CAN1_RX0 6, SysTick 15). A task switch only happens when no handler is active.

`tools/tracestat.py` summarises a capture.

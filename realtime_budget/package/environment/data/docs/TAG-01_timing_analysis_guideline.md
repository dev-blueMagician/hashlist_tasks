# TAG-01 Timing analysis guideline, ECP-300

Revision C, 2025-02-11. Applies to ECP-300 software 3.x. Owner: controls software team.

## 1 Purpose

This guideline says how the timing values in `os_cfg.c` (TMON budgets, task priorities and the IWDG setting) are derived and reviewed against SRS-ECP300 (SR-TIM, SR-WDG). A release's TAG review re-does sections 2 to 5 with that release's code and reference traces.

## 2 Inputs

2.1 **Task WCET C_i.** Largest net execution time of one job: CPU time of the task itself, without any interrupt time. Take it from the reference traces of the release.

2.2 **Interrupt WCET C_k.** Largest execution time of the handler, ISR_ENTER to ISR_EXIT, without nested higher-priority interrupts. Take it from the reference traces of the release.

2.3 **Interrupt minimum inter-arrival T_k.** For timer-driven interrupts, the configured period. For event-driven interrupts, the shortest inter-arrival the event source allows under the worst-case conditions of SRS-ECP300. Traces show what happened during one capture, so they do not give T_k for event-driven interrupts.

2.4 Periods T_i and deadlines D_i of the tasks are given by SRS-ECP300.

## 3 TMON budgets

TMON (`tmon.c`) measures a job from `tmon_job_begin()` to `tmon_job_end()` and counts the time the task is switched in. It subtracts the time of interrupt handlers that bracket their body with `TMON_ISR_ENTER()` / `TMON_ISR_EXIT()`. Any other handler that runs while the job is switched in is counted in the job's execution time; this guideline calls those interrupts *charged*.

Largest monitored time of a fault-free job of task i:

```
W_i = C_i + sum over all interrupts k      of  ceil(W_i / T_k) * C_k     (smallest solution, start at W_i = C_i)
M_i = C_i + sum over charged interrupts k  of  ceil(W_i / T_k) * C_k
```

Budget rule (SR-TIM-03, SR-TIM-04): `M_i <= B_i <= 1.25 * M_i`, B_i in whole microseconds.

## 4 Response times with budgets

With TMON active, a job of task j occupies the CPU, charged interrupts included, for at most B_j. Response time of task i:

```
R_i = B_i + sum over j in hp(i) of ceil(R_i / T_j) * B_j
          + sum over bracketed interrupts k of ceil(R_i / T_k) * C_k
```

hp(i) is every other task with a priority higher than or equal to that of task i. SR-TIM-01 requires `R_i <= D_i` for every task.

## 5 Watchdog

The Supervisor refreshes the IWDG as the last action of each job, so two refreshes are at most `K = T_sup + R_sup` apart (best-case response time taken as 0).

The IWDG times out after `t_IWDG = 4 * 2^PR * (RL + 1) / f_LSI`, with PR the prescaler code and RL the reload value (RM0090, independent watchdog). SR-WDG-01 requires `t_IWDG > K`; SR-WDG-02 requires `t_IWDG <= 80 ms`.

## Appendix A: interrupt inventory, software 3.1.0

Reviewed 2025-02-11 with the 3.1.0 reference traces.

| Handler | NVIC priority | Source | T_k | C_k | TMON |
| --- | --- | --- | --- | --- | --- |
| ADC_IRQHandler | 1 | FOC current loop, TIM1 trigger | 50 us | 8.6 us | bracketed |
| CAN1_RX0_IRQHandler | 6 | can_legacy.c, FIFO 0, list filter 0x18A and 0x6F1 | 10 ms | 6.9 us | bracketed |
| SysTick_Handler | 15 | FreeRTOS tick (port.c) | 1 ms | 2.8 us | charged |

## Appendix B: values, software 3.1.0

| Task | Priority | T_i = D_i | C_i | M_i | B_i | R_i |
| --- | --- | --- | --- | --- | --- | --- |
| SpeedCtrl | 5 | 1 ms | 158 us | 160.8 us | 200 us | 250 us |
| CanComm | 4 | 5 ms | 374 us | 376.8 us | 470 us | 823 us |
| Monitor | 3 | 10 ms | 766 us | 768.8 us | 960 us | 2467 us |
| Supervisor | 2 | 20 ms | 238 us | 240.8 us | 300 us | 2827 us |
| NvM | 1 | 100 ms | 3830 us | 3844.0 us | 4800 us | 13583 us |

IWDG: PR = 0, RL = 255, 1024 LSI periods, t_IWDG = 32.0 ms at 32 kHz. K = 20 ms + 2.83 ms = 22.83 ms < 32.0 ms. Hung controller reset after 32.0 ms <= 80 ms.

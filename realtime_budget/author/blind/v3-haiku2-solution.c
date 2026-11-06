/* os_cfg.c - ECP-300 task table and independent watchdog setting
 *
 * Timing configuration of the coolant pump controller. Budgets and the IWDG
 * setting are derived and reviewed with TAG-01 (docs/); periods and deadlines
 * come from SRS-ECP300 and must not change here.
 *
 * 3.2.1: budgets from TAG-01 sections 2-5 with the 3.2.0 reference traces.
 * CAN receive ISR (charged, not bracketed) and the IWDG setting are re-derived.
 */
#include "os_cfg.h"

const os_task_cfg_t os_task_cfg[TASK_COUNT] = {
    /*                   name          prio  period_us  deadline_us  budget_us  stack */
    [TASK_SPEEDCTRL]  = { "SpeedCtrl",  5,      1000,       1000,         257,    384 },
    [TASK_CANCOMM]    = { "CanComm",    4,      5000,       5000,         539,    512 },
    [TASK_MONITOR]    = { "Monitor",    3,     10000,      10000,        1150,    512 },
    [TASK_SUPERVISOR] = { "Supervisor", 2,     20000,      20000,         347,    256 },
    [TASK_NVM]        = { "NvM",        1,    100000,     100000,        5533,    768 },
};

/* PR = 0 (/4), RL = 307: 4 * 1 * (307 + 1) = 1232 LSI periods.
 * LSI 47 kHz (max): 26.2 ms > K = 23.74 ms (SR-WDG-01).
 * LSI 17 kHz (min): 72.5 ms <= 80 ms (SR-WDG-02). Nominal 32 kHz: 38.5 ms. */
const os_iwdg_cfg_t os_iwdg_cfg = {
    .prescaler = 0u,
    .reload    = 307u,
};

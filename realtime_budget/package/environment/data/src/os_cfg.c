/* os_cfg.c - ECP-300 task table and independent watchdog setting
 *
 * Timing configuration of the coolant pump controller. Budgets and the IWDG
 * setting are derived and reviewed with TAG-01 (docs/); periods and deadlines
 * come from SRS-ECP300 and must not change here.
 *
 * 3.2.0: values carried over from 3.1.0 (TAG-01 review 2026-06-18).
 */
#include "os_cfg.h"

const os_task_cfg_t os_task_cfg[TASK_COUNT] = {
    /*                   name          prio  period_us  deadline_us  budget_us  stack */
    [TASK_SPEEDCTRL]  = { "SpeedCtrl",  5,      1000,       1000,         200,    384 },
    [TASK_CANCOMM]    = { "CanComm",    4,      5000,       5000,         470,    512 },
    [TASK_MONITOR]    = { "Monitor",    3,     10000,      10000,         960,    512 },
    [TASK_SUPERVISOR] = { "Supervisor", 2,     20000,      20000,         300,    256 },
    [TASK_NVM]        = { "NvM",        1,    100000,     100000,        4800,    768 },
};

/* 4 * 2^0 * (255 + 1) = 1024 LSI periods: 32.0 ms at 32 kHz */
const os_iwdg_cfg_t os_iwdg_cfg = {
    .prescaler = 0u,
    .reload    = 255u,
};

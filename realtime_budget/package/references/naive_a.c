/* os_cfg.c - ECP-300 task table and independent watchdog setting
 *
 * 3.2.1 (near miss: worst case taken from the captures).
 *
 * Budgets are 15 % above the largest TMON measurement in the three
 * reference traces: SpeedCtrl 178.4, CanComm 431.0, Monitor 782.5,
 * Supervisor 268.2, NvM 4113.6 us. The service-bay capture already contains
 * a full ECM reprogramming, so it is taken as the worst bus traffic.
 * IWDG checked over the LSI range: K with these budgets is about 22.8 ms;
 * 1240 LSI periods give 26.4 ms at 47 kHz and 72.9 ms at 17 kHz.
 */
#include "os_cfg.h"

const os_task_cfg_t os_task_cfg[TASK_COUNT] = {
    /*                   name          prio  period_us  deadline_us  budget_us  stack */
    [TASK_SPEEDCTRL]  = { "SpeedCtrl",  5,      1000,       1000,         206,    384 },
    [TASK_CANCOMM]    = { "CanComm",    4,      5000,       5000,         496,    512 },
    [TASK_MONITOR]    = { "Monitor",    3,     10000,      10000,         900,    512 },
    [TASK_SUPERVISOR] = { "Supervisor", 2,     20000,      20000,         309,    256 },
    [TASK_NVM]        = { "NvM",        1,    100000,     100000,        4731,    768 },
};

const os_iwdg_cfg_t os_iwdg_cfg = {
    .prescaler = 0u,
    .reload    = 309u,
};

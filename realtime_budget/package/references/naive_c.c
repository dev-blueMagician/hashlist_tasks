/* os_cfg.c - ECP-300 task table and independent watchdog setting
 *
 * 3.2.1 (near miss: TAG-01 appendix A inventory taken as still valid).
 *
 * CAN1_RX0 treated as bracketed, as in TAG-01 appendix A, so only SysTick
 * is charged to the jobs. C_i from the 3.2 traces: 150, 380, 780, 240,
 * 3900 us; M_i = 153, 383, 783, 243, 3915 us; B_i = 1.25 M_i, the most
 * SR-TIM-04 allows, to give the field the largest margin.
 * IWDG checked over the LSI range: 1280 LSI periods give 27.2 ms at
 * 47 kHz and 75.3 ms at 17 kHz.
 */
#include "os_cfg.h"

const os_task_cfg_t os_task_cfg[TASK_COUNT] = {
    /*                   name          prio  period_us  deadline_us  budget_us  stack */
    [TASK_SPEEDCTRL]  = { "SpeedCtrl",  5,      1000,       1000,         191,    384 },
    [TASK_CANCOMM]    = { "CanComm",    4,      5000,       5000,         478,    512 },
    [TASK_MONITOR]    = { "Monitor",    3,     10000,      10000,         978,    512 },
    [TASK_SUPERVISOR] = { "Supervisor", 2,     20000,      20000,         303,    256 },
    [TASK_NVM]        = { "NvM",        1,    100000,     100000,        4893,    768 },
};

const os_iwdg_cfg_t os_iwdg_cfg = {
    .prescaler = 0u,
    .reload    = 319u,
};

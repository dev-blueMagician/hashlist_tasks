/* os_cfg.c - ECP-300 task table and independent watchdog setting
 *
 * 3.2.1 (near miss: watchdog sized for the nominal LSI only).
 *
 * Budgets as in the correct answer: CAN1_RX0 charged to the jobs, VN-07
 * back-to-back diagnostic frames (222 us, 52 us each), B_i = ceil(1.10 M_i).
 * IWDG: K = 24.47 ms. At the LSI's 32 kHz, 4 * (244 + 1) = 980 periods
 * = 30.6 ms, 25 % above K, and well below the 80 ms of SR-WDG-02.
 */
#include "os_cfg.h"

const os_task_cfg_t os_task_cfg[TASK_COUNT] = {
    /*                   name          prio  period_us  deadline_us  budget_us  stack */
    [TASK_SPEEDCTRL]  = { "SpeedCtrl",  5,      1000,       1000,         283,    384 },
    [TASK_CANCOMM]    = { "CanComm",    4,      5000,       5000,         593,    512 },
    [TASK_MONITOR]    = { "Monitor",    3,     10000,      10000,        1265,    512 },
    [TASK_SUPERVISOR] = { "Supervisor", 2,     20000,      20000,         382,    256 },
    [TASK_NVM]        = { "NvM",        1,    100000,     100000,        6087,    768 },
};

const os_iwdg_cfg_t os_iwdg_cfg = {
    .prescaler = 0u,
    .reload    = 244u,
};

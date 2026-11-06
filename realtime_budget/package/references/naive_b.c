/* os_cfg.c - ECP-300 task table and independent watchdog setting
 *
 * 3.2.1 (near miss: watchdog sized for the nominal LSI only).
 *
 * Budgets as in the correct answer: CAN1_RX0 charged at 222 us, ADC at 25 us
 * below 900 rpm, B_i = ceil(1.02 M_i).
 * IWDG: K = 27.99 ms. At the LSI's 32 kHz, 4 * (279 + 1) = 1120 periods
 * = 35.0 ms, 25 % above K, and well below the 80 ms of SR-WDG-02.
 */
#include "os_cfg.h"

const os_task_cfg_t os_task_cfg[TASK_COUNT] = {
    /*                   name          prio  period_us  deadline_us  budget_us  stack */
    [TASK_SPEEDCTRL]  = { "SpeedCtrl",  5,      1000,       1000,         263,    384 },
    [TASK_CANCOMM]    = { "CanComm",    4,      5000,       5000,         659,    512 },
    [TASK_MONITOR]    = { "Monitor",    3,     10000,      10000,        1280,    512 },
    [TASK_SUPERVISOR] = { "Supervisor", 2,     20000,      20000,         407,    256 },
    [TASK_NVM]        = { "NvM",        1,    100000,     100000,        6343,    768 },
};

const os_iwdg_cfg_t os_iwdg_cfg = {
    .prescaler = 0u,
    .reload    = 279u,
};

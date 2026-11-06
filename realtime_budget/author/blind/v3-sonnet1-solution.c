/* os_cfg.c - ECP-300 task table and independent watchdog setting
 *
 * Timing configuration of the coolant pump controller. Budgets and the IWDG
 * setting are derived and reviewed with TAG-01 (docs/); periods and deadlines
 * come from SRS-ECP300 and must not change here.
 *
 * 3.2.1: re-derived with TAG-01 for 3.2.0 code. Interrupts: ADC 25 us / 9.0 us
 * (bracketed), CAN1_RX0 222 us / 52.0 us (charged), SysTick 1000 us / 3.0 us
 * (charged). Priorities unchanged (rate monotonic).
 */
#include "os_cfg.h"

const os_task_cfg_t os_task_cfg[TASK_COUNT] = {
    /*                   name          prio  period_us  deadline_us  budget_us  stack */
    [TASK_SPEEDCTRL]  = { "SpeedCtrl",  5,      1000,       1000,         257,    384 },
    [TASK_CANCOMM]    = { "CanComm",    4,      5000,       5000,         646,    512 },
    [TASK_MONITOR]    = { "Monitor",    3,     10000,      10000,         1254,   512 },
    [TASK_SUPERVISOR] = { "Supervisor", 2,     20000,      20000,         399,    256 },
    [TASK_NVM]        = { "NvM",        1,    100000,     100000,        6218,    768 },
};

/* 4 * 2^0 * (333 + 1) = 1336 LSI periods; LSI 17..47 kHz (datasheet):
 * 28.4 ms .. 78.6 ms. K = 20 ms + 7.82 ms = 27.82 ms < 28.4 ms, max <= 80 ms */
const os_iwdg_cfg_t os_iwdg_cfg = {
    .prescaler = 0u,
    .reload    = 333u,
};

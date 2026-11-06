/* os_cfg.c - ECP-300 task table and independent watchdog setting
 *
 * Timing configuration of the coolant pump controller. Budgets and the IWDG
 * setting are derived and reviewed with TAG-01 (docs/); periods and deadlines
 * come from SRS-ECP300 and must not change here.
 *
 * 3.2.1: re-derived with TAG-01 using the 3.2.0 reference traces and the
 * worst-case interrupt inventory:
 *   ADC_IRQHandler  T = 25 us (TIM1 RCR = 0 in LowRipple mode), C = 9.0 us, bracketed
 *   CAN1_RX0        T = 222 us (back-to-back 8-byte frames, 111 bit), C = 52.0 us, charged
 *   SysTick         T = 1000 us, C = 3.0 us, charged
 * Supervisor runs above CanComm so the watchdog refresh interval stays short.
 */
#include "os_cfg.h"

const os_task_cfg_t os_task_cfg[TASK_COUNT] = {
    /*                   name          prio  period_us  deadline_us  budget_us  stack */
    [TASK_SPEEDCTRL]  = { "SpeedCtrl",  5,      1000,       1000,         283,    384 },
    [TASK_CANCOMM]    = { "CanComm",    3,      5000,       5000,         551,    512 },
    [TASK_MONITOR]    = { "Monitor",    2,     10000,      10000,        1380,    512 },
    [TASK_SUPERVISOR] = { "Supervisor", 4,     20000,      20000,         439,    256 },
    [TASK_NVM]        = { "NvM",        1,    100000,     100000,        6840,    768 },
};

/* 4 * 2^0 * (296 + 1) = 1188 LSI periods: 69.9 ms at 17 kHz, 25.3 ms at 47 kHz */
const os_iwdg_cfg_t os_iwdg_cfg = {
    .prescaler = 0u,
    .reload    = 296u,
};

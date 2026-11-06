/* os_cfg.c - ECP-300 task table and independent watchdog setting
 *
 * Timing configuration of the coolant pump controller. Budgets and the IWDG
 * setting are derived and reviewed with TAG-01 (docs/); periods and deadlines
 * come from SRS-ECP300 and must not change here.
 *
 * 3.2.1: re-derived with TAG-01 for 3.2.0 code. Interrupt inventory:
 *   ADC_IRQHandler   T = 25 us (TIM1 RCR = 0 in LowRipple mode), C = 9.0 us, bracketed
 *   CAN1_RX0         T = 222 us (back-to-back 8-byte frames, 111 bit at 500 kbit/s,
 *                    diagnostic IDs 0x700-0x7FF pass the filter), C = 52 us, charged
 *   SysTick          T = 1 ms, C = 3.0 us, charged
 * M_i = 257 / 646 / 1254 / 399 / 6218 us. Response times with these budgets:
 * 0.42 / 1.86 / 7.99 / 2.90 / 77.8 ms. Supervisor runs above Monitor so the
 * watchdog refresh interval stays short.
 */
#include "os_cfg.h"

const os_task_cfg_t os_task_cfg[TASK_COUNT] = {
    /*                   name          prio  period_us  deadline_us  budget_us  stack */
    [TASK_SPEEDCTRL]  = { "SpeedCtrl",  5,      1000,       1000,         263,    384 },
    [TASK_CANCOMM]    = { "CanComm",    4,      5000,       5000,         659,    512 },
    [TASK_MONITOR]    = { "Monitor",    2,     10000,      10000,        1280,    512 },
    [TASK_SUPERVISOR] = { "Supervisor", 3,     20000,      20000,         407,    256 },
    [TASK_NVM]        = { "NvM",        1,    100000,     100000,        6839,    768 },
};

/* 4 * 2^0 * (304 + 1) = 1220 LSI periods. LSI 17..47 kHz (DS table 35):
 * 26.0 ms to 71.8 ms. K = 20 + 2.9 ms = 22.9 ms < 26.0 ms; 71.8 ms <= 80 ms. */
const os_iwdg_cfg_t os_iwdg_cfg = {
    .prescaler = 0u,
    .reload    = 304u,
};

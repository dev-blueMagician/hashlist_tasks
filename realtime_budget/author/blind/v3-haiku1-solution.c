/* os_cfg.c - ECP-300 task table and independent watchdog setting
 *
 * Timing configuration of the coolant pump controller. Budgets and the IWDG
 * setting are derived and reviewed with TAG-01 (docs/); periods and deadlines
 * come from SRS-ECP300 and must not change here.
 *
 * 3.2.1: budgets and IWDG re-derived with TAG-01 for the 3.2.0 code.
 *   Interrupts (TAG-01 section 2):
 *     ADC_IRQHandler      T = 50 us (TIM1 PWM, ARR 4200 centre-aligned, 20 kHz),
 *                         C = 9.00 us, bracketed by TMON
 *     CAN1_RX0_IRQHandler T = 222 us (111 bit times, shortest 8-byte frame at
 *                         500 kbit/s, VN-07 3.4, 5.1), C = 52.00 us, charged
 *     SysTick_Handler     T = 1 ms, C = 3.00 us, charged
 *   Task C_i: net maximum of the three reference traces (tracestat).
 *   Budgets: B_i = ceil(1.1 * M_i), inside M_i <= B_i <= 1.25 M_i.
 *   IWDG: LSI 17..47 kHz (DS table 35), PR = 0, RL = 313:
 *     t_IWDG 26.7 ms at 47 kHz > K = T_sup + R_sup = 24.5 ms,
 *     t_IWDG 73.9 ms at 17 kHz <= 80 ms.
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

/* PR = 0: divider /4. t = 4 * (313 + 1) / f_LSI: 26.7 ms at 47 kHz, 39.3 ms at 32 kHz, 73.9 ms at 17 kHz */
const os_iwdg_cfg_t os_iwdg_cfg = {
    .prescaler = 0u,
    .reload    = 313u,
};

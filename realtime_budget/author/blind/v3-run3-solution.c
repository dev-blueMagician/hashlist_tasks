/* os_cfg.c - ECP-300 task table and independent watchdog setting
 *
 * Timing configuration of the coolant pump controller. Budgets and the IWDG
 * setting are derived and reviewed with TAG-01 (docs/); periods and deadlines
 * come from SRS-ECP300 and must not change here.
 *
 * 3.2.1: re-derived with TAG-01 for the 3.2.0 code and reference traces.
 *   Interrupts (C_k from the 3.2.0 traces, T_k per TAG-01 2.3):
 *     ADC_IRQHandler   C = 9.0 us, T = 25 us (TIM1 TRGO = update event; RCR = 0
 *                      in PwmMode_LowRipple, used below 900 rpm), bracketed
 *     CAN1_RX0         C = 52.0 us (diagnostic IDs 0x7E0/0x7E8), T = 222 us
 *                      (filter bank 1 accepts 0x700-0x7FF; back-to-back 8-byte
 *                      frames, 111 bit times at 500 kbit/s, VN-07), charged
 *     SysTick_Handler  C = 3.0 us, T = 1 ms, charged
 *   Task       C_i      M_i      B_i    R_i
 *   SpeedCtrl  150 us    257 us   262   415 us
 *   CanComm    380 us    646 us   660  2900 us
 *   Monitor    780 us   1254 us  1280  7986 us
 *   Supervisor 240 us    399 us   410  1465 us   (priority raised above CanComm)
 *   NvM       3900 us   6218 us  6350 69586 us
 *   IWDG: K = 20 ms + 1.465 ms = 21.47 ms. 4 * 2^0 * (299 + 1) = 1200 LSI
 *   periods: 25.5 ms at f_LSI max 47 kHz (> K), 70.6 ms at f_LSI min 17 kHz
 *   (<= 80 ms), 37.5 ms at 32 kHz.
 */
#include "os_cfg.h"

const os_task_cfg_t os_task_cfg[TASK_COUNT] = {
    /*                   name          prio  period_us  deadline_us  budget_us  stack */
    [TASK_SPEEDCTRL]  = { "SpeedCtrl",  5,      1000,       1000,         262,    384 },
    [TASK_CANCOMM]    = { "CanComm",    3,      5000,       5000,         660,    512 },
    [TASK_MONITOR]    = { "Monitor",    2,     10000,      10000,        1280,    512 },
    [TASK_SUPERVISOR] = { "Supervisor", 4,     20000,      20000,         410,    256 },
    [TASK_NVM]        = { "NvM",        1,    100000,     100000,        6350,    768 },
};

/* 4 * 2^0 * (299 + 1) = 1200 LSI periods: 25.5 ms to 70.6 ms over 17..47 kHz */
const os_iwdg_cfg_t os_iwdg_cfg = {
    .prescaler = 0u,
    .reload    = 299u,
};

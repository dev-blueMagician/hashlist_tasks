/* os_cfg.c - ECP-300 task table and independent watchdog setting
 *
 * Timing configuration of the coolant pump controller. Budgets and the IWDG
 * setting are derived and reviewed with TAG-01 (docs/); periods and deadlines
 * come from SRS-ECP300 and must not change here.
 *
 * 3.2.1: re-derived with TAG-01 for the 3.2.0 code (3.1.0 values were carried
 * over unchecked and caused the field TMON and IWDG resets).
 *
 * Interrupt inventory, 3.2.0 (C_k from the three 3.2.0 reference traces):
 *   ADC_IRQHandler       bracketed  C = 9.0 us   T = 25 us
 *       TIM1 TRGO (update) trigger, centre-aligned ARR = 4200 at 168 MHz;
 *       PwmMode_LowRipple (below 900 rpm) sets RCR = 0, so an update at
 *       every overflow and underflow: 25 us instead of 50 us.
 *   CAN1_RX0_IRQHandler  charged    C = 52.0 us  T = 222 us
 *       no TMON brackets in can_if_glue.c; filter bank 1 (mask 0x700) accepts
 *       all of 0x700..0x7FF, which VN-07 4.2/4.5 allows back to back:
 *       111 bit times at 500 kbit/s. C from the 0x7E0 frames (ECM reflash).
 *   SysTick_Handler      charged    C = 3.0 us   T = 1 ms
 *
 *   Task        C_i      W_i      M_i     B_i     R_i
 *   SpeedCtrl   150 us   410 us   257 us  262 us   415 us
 *   CanComm     380 us  1015 us   646 us  660 us  2898 us
 *   Monitor     780 us  1965 us  1254 us 1280 us  7975 us
 *   Supervisor  240 us   624 us   399 us  408 us  1463 us
 *   NvM        3900 us  9719 us  6218 us 6350 us 69569 us
 *
 * Supervisor is raised above CanComm and Monitor to keep its response time,
 * and so the refresh interval K, short.
 */
#include "os_cfg.h"

const os_task_cfg_t os_task_cfg[TASK_COUNT] = {
    /*                   name          prio  period_us  deadline_us  budget_us  stack */
    [TASK_SPEEDCTRL]  = { "SpeedCtrl",  5,      1000,       1000,         262,    384 },
    [TASK_CANCOMM]    = { "CanComm",    3,      5000,       5000,         660,    512 },
    [TASK_MONITOR]    = { "Monitor",    2,     10000,      10000,        1280,    512 },
    [TASK_SUPERVISOR] = { "Supervisor", 4,     20000,      20000,         408,    256 },
    [TASK_NVM]        = { "NvM",        1,    100000,     100000,        6350,    768 },
};

/* 4 * 2^0 * (334 + 1) = 1340 LSI periods, f_LSI 17..47 kHz (DS8626 table 35):
 * 28.5 ms at 47 kHz > K = 20 ms + 1.46 ms; 78.8 ms at 17 kHz <= 80 ms. */
const os_iwdg_cfg_t os_iwdg_cfg = {
    .prescaler = 0u,
    .reload    = 334u,
};

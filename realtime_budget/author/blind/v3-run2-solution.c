/* os_cfg.c - ECP-300 task table and independent watchdog setting
 *
 * Timing configuration of the coolant pump controller. Budgets and the IWDG
 * setting are derived and reviewed with TAG-01 (docs/); periods and deadlines
 * come from SRS-ECP300 and must not change here.
 *
 * 3.2.1: TAG-01 re-done with the 3.2.0 code and reference traces.
 *
 * Interrupt inventory, 3.2.0:
 *   ADC_IRQHandler       bracketed  C =  9.0 us  T =  25 us  (TIM1 TRGO = update;
 *                        center-aligned, ARR 4200 at 168 MHz; LowRipple mode has
 *                        RCR = 0, update on overflow and underflow, used < 900 rpm)
 *   CAN1_RX0_IRQHandler  charged    C = 52.0 us  T = 222 us  (can_if_glue.c has no
 *                        TMON brackets; filter bank 1 is id/mask 0x7DF/0x700 and
 *                        accepts 0x700..0x7FF; VN-07: back-to-back 8-byte frames,
 *                        111 bit times at 500 kbit/s; C from service_bay_ecm_reflash)
 *   SysTick_Handler      charged    C =  3.0 us  T = 1000 us
 *
 *   Task        C_i      M_i      B_i    prio  R_i
 *   SpeedCtrl   150 us    257 us   260   5      413 us
 *   CanComm     380 us    646 us   650   3     2865 us
 *   Monitor     780 us   1254 us  1260   2     7875 us
 *   Supervisor  240 us    399 us   400   4     1442 us
 *   NvM        3900 us   6218 us  6250   1    67894 us
 *
 * Supervisor is placed directly below SpeedCtrl so that its response time,
 * and with it the refresh interval K = 20 ms + 1.44 ms = 21.44 ms, stays well
 * inside the IWDG window over the full LSI tolerance (17..47 kHz, datasheet).
 */
#include "os_cfg.h"

const os_task_cfg_t os_task_cfg[TASK_COUNT] = {
    /*                   name          prio  period_us  deadline_us  budget_us  stack */
    [TASK_SPEEDCTRL]  = { "SpeedCtrl",  5,      1000,       1000,         260,    384 },
    [TASK_CANCOMM]    = { "CanComm",    3,      5000,       5000,         650,    512 },
    [TASK_MONITOR]    = { "Monitor",    2,     10000,      10000,        1260,    512 },
    [TASK_SUPERVISOR] = { "Supervisor", 4,     20000,      20000,         400,    256 },
    [TASK_NVM]        = { "NvM",        1,    100000,     100000,        6250,    768 },
};

/* 4 * 2^0 * (299 + 1) = 1200 LSI periods:
 *   25.5 ms at 47 kHz (> K = 21.44 ms), 37.5 ms at 32 kHz, 70.6 ms at 17 kHz (<= 80 ms) */
const os_iwdg_cfg_t os_iwdg_cfg = {
    .prescaler = 0u,
    .reload    = 299u,
};

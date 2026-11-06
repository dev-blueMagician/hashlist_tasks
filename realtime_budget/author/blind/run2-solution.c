/* os_cfg.c - ECP-300 task table and independent watchdog setting
 *
 * Timing configuration of the coolant pump controller. Budgets and the IWDG
 * setting are derived and reviewed with TAG-01 (docs/); periods and deadlines
 * come from SRS-ECP300 and must not change here.
 *
 * 3.2.1: re-derived with TAG-01 from the 3.2.0 code and reference traces.
 * Interrupts used (C_k = largest value in the three traces):
 *   ADC_IRQHandler       T = 50 us (TIM1 20 kHz)        C = 9 us   bracketed
 *   CAN1_RX0_IRQHandler  T = 222 us (VN-07 4.2, 4.5, 5.1, back-to-back
 *                        frames; filter bank 1 accepts 0x700..0x7FF)
 *                                                       C = 52 us  charged
 *   SysTick_Handler      T = 1000 us (1 kHz tick)       C = 3 us   charged
 * M_i: SpeedCtrl 257, CanComm 539, Monitor 1150, Supervisor 347, NvM 5533 us.
 */
#include "os_cfg.h"

const os_task_cfg_t os_task_cfg[TASK_COUNT] = {
    /*                   name          prio  period_us  deadline_us  budget_us  stack */
    [TASK_SPEEDCTRL]  = { "SpeedCtrl",  5,      1000,       1000,         285,    384 },
    [TASK_CANCOMM]    = { "CanComm",    4,      5000,       5000,         595,    512 },
    [TASK_MONITOR]    = { "Monitor",    3,     10000,      10000,        1270,    512 },
    [TASK_SUPERVISOR] = { "Supervisor", 2,     20000,      20000,         385,    256 },
    [TASK_NVM]        = { "NvM",        1,    100000,     100000,        6100,    768 },
};

/* 4 * 2^0 * (319 + 1) = 1280 LSI periods. f_LSI is 17 to 47 kHz (DS8626, LSI
 * oscillator characteristics, -40 to 105 C):
 * 27.2 ms at 47 kHz > K = 24.5 ms; 75.3 ms at 17 kHz <= 80 ms. */
const os_iwdg_cfg_t os_iwdg_cfg = {
    .prescaler = 0u,
    .reload    = 319u,
};

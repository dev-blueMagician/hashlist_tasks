/* os_cfg.c - ECP-300 task table and independent watchdog setting
 *
 * Timing configuration of the coolant pump controller. Budgets and the IWDG
 * setting are derived with TAG-01 (docs/); periods and deadlines come from
 * SRS-ECP300 and must not change here.
 *
 * 3.2.1: budgets and IWDG re-derived with TAG-01 sections 2 to 5 for the 3.2.0
 * code. Appendix A of TAG-01 no longer holds for this code: CAN1_RX0 now runs
 * the CanIf stack, has no TMON brackets, and filter bank 1 (mask 0x700) lets in
 * every diagnostic frame 0x700..0x7FF.
 *
 * Interrupts (C_k: largest in the 3.2.0 reference traces):
 *   ADC_IRQHandler       T =  50 us (TIM1, 20 kHz)        C =  9.0 us  bracketed
 *   CAN1_RX0_IRQHandler  T = 222 us (VN-07 4.2, 4.5, 5.1) C = 52.0 us  charged
 *   SysTick_Handler      T =   1 ms (tick)                C =  3.0 us  charged
 *
 * Task       C_i us (traces)   W_i us  M_i us  B_i us  R_i us
 * SpeedCtrl       150 (max)       320     257     285     348
 * CanComm         380 (svc)       665     539     595    1426
 * Monitor         780 (max)      1411    1150    1265    3666
 * Supervisor      240 (svc)       428     347     385    4480
 * NvM            3900 (svc)      6748    5533    6100   26745
 */
#include "os_cfg.h"

const os_task_cfg_t os_task_cfg[TASK_COUNT] = {
    /*                   name          prio  period_us  deadline_us  budget_us  stack */
    [TASK_SPEEDCTRL]  = { "SpeedCtrl",  5,      1000,       1000,         285,    384 },
    [TASK_CANCOMM]    = { "CanComm",    4,      5000,       5000,         595,    512 },
    [TASK_MONITOR]    = { "Monitor",    3,     10000,      10000,        1265,    512 },
    [TASK_SUPERVISOR] = { "Supervisor", 2,     20000,      20000,         385,    256 },
    [TASK_NVM]        = { "NvM",        1,    100000,     100000,        6100,    768 },
};

/* 4 * 2^0 * (319 + 1) = 1280 LSI periods. f_LSI 17 to 47 kHz (DS8626, LSI table):
 * 27.2 ms at 47 kHz > K = 20 ms + 4.48 ms = 24.48 ms (SR-WDG-01),
 * 75.3 ms at 17 kHz <= 80 ms (SR-WDG-02). 40.0 ms at the typical 32 kHz. */
const os_iwdg_cfg_t os_iwdg_cfg = {
    .prescaler = 0u,
    .reload    = 319u,
};

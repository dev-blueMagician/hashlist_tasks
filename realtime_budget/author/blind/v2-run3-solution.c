/* os_cfg.c - ECP-300 task table and independent watchdog setting
 *
 * Timing configuration of the coolant pump controller. Budgets and the IWDG
 * setting are derived and reviewed with TAG-01 (docs/); periods and deadlines
 * come from SRS-ECP300 and must not change here.
 *
 * 3.2.1: re-derived for the 3.2.0 code, whose interrupt load differs from the
 * 3.1.0 inventory in TAG-01 appendix A. Values in us (168 MHz).
 *
 * Interrupts:
 *   ADC_IRQHandler      C = 9.0   T = 25   bracketed  TIM1 at RCR = 0 below 900 rpm (foc_pwm.c)
 *   CAN1_RX0_IRQHandler C = 52.0  T = 222  charged    0x700-0x7FF accepted, 111 bits at 500 kbit/s (VN-07)
 *   SysTick_Handler     C = 3.0   T = 1000 charged
 *
 * Task         C_i     W_i     M_i     B_i     R_i
 * SpeedCtrl    150     410     257     262     415
 * CanComm      380    1015     646     660    1850
 * Monitor      780    1965    1254    1280    6936
 * Supervisor   240     624     399     410    7986
 * NvM         3900    9719    6218    6400   69663
 */
#include "os_cfg.h"

const os_task_cfg_t os_task_cfg[TASK_COUNT] = {
    /*                   name          prio  period_us  deadline_us  budget_us  stack */
    [TASK_SPEEDCTRL]  = { "SpeedCtrl",  5,      1000,       1000,         262,    384 },
    [TASK_CANCOMM]    = { "CanComm",    4,      5000,       5000,         660,    512 },
    [TASK_MONITOR]    = { "Monitor",    3,     10000,      10000,        1280,    512 },
    [TASK_SUPERVISOR] = { "Supervisor", 2,     20000,      20000,         410,    256 },
    [TASK_NVM]        = { "NvM",        1,    100000,     100000,        6400,    768 },
};

/* 4 * 2^0 * (334 + 1) = 1340 LSI periods. f_LSI is 17 to 47 kHz (datasheet):
 * 28.51 ms at 47 kHz > K = 20 ms + 7.99 ms = 27.99 ms (SR-WDG-01)
 * 78.82 ms at 17 kHz <= 80 ms (SR-WDG-02) */
const os_iwdg_cfg_t os_iwdg_cfg = {
    .prescaler = 0u,
    .reload    = 334u,
};

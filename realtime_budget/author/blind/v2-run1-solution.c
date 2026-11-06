/* os_cfg.c - ECP-300 task table and independent watchdog setting
 *
 * Timing configuration of the coolant pump controller. Budgets and the IWDG
 * setting are derived and reviewed with TAG-01 (docs/); periods and deadlines
 * come from SRS-ECP300 and must not change here.
 *
 * 3.2.1: budgets and IWDG re-derived with TAG-01 sections 2 to 5 for the 3.2.0
 * code. The 3.1.0 values did not cover these changes:
 *
 *   ADC_IRQHandler       bracketed, C = 9.00 us (5200 rpm trace),
 *                        T = 25 us: below 900 rpm foc_pwm.c sets RCR = 0, so
 *                        TRGO comes at every overflow and underflow of the
 *                        center-aligned TIM1 (RM0090 17.3.3). The traces only
 *                        show 50 us because none runs below 900 rpm.
 *   CAN1_RX0_IRQHandler  charged, no TMON brackets in can_if_glue.c,
 *                        C = 52.00 us (0x7E0, workshop trace),
 *                        T = 222 us: 111 bit times at 500 kbit/s, back to back
 *                        (VN-07 4.2, 4.5, 5.1). Filter bank 1 passes all of
 *                        0x700 to 0x7FF to the handler.
 *   SysTick_Handler      charged, C = 3.00 us, T = 1 ms.
 *
 *   Task        C_i us   M_i us  B_i us  R_i us
 *   SpeedCtrl      150      257     262     415
 *   CanComm        380      646     660    1850
 *   Monitor        780     1254    1280    6936
 *   Supervisor     240      399     408    7975
 *   NvM           3900     6218    6350   69569
 */
#include "os_cfg.h"

const os_task_cfg_t os_task_cfg[TASK_COUNT] = {
    /*                   name          prio  period_us  deadline_us  budget_us  stack */
    [TASK_SPEEDCTRL]  = { "SpeedCtrl",  5,      1000,       1000,         262,    384 },
    [TASK_CANCOMM]    = { "CanComm",    4,      5000,       5000,         660,    512 },
    [TASK_MONITOR]    = { "Monitor",    3,     10000,      10000,        1280,    512 },
    [TASK_SUPERVISOR] = { "Supervisor", 2,     20000,      20000,         408,    256 },
    [TASK_NVM]        = { "NvM",        1,    100000,     100000,        6350,    768 },
};

/* 4 * 2^0 * (335 + 1) = 1344 LSI periods. LSI is 17 to 47 kHz (DS8626 table 35):
 * 28.6 ms at 47 kHz, above K = 20 ms + R_Supervisor = 27.98 ms;
 * 79.1 ms at 17 kHz, within the 80 ms of SR-WDG-02. */
const os_iwdg_cfg_t os_iwdg_cfg = {
    .prescaler = 0u,
    .reload    = 335u,
};

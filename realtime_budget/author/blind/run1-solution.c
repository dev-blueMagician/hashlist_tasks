/* os_cfg.c - ECP-300 task table and independent watchdog setting
 *
 * Timing configuration of the coolant pump controller. Budgets and the IWDG
 * setting are derived and reviewed with TAG-01 (docs/); periods and deadlines
 * come from SRS-ECP300 and must not change here.
 *
 * 3.2.1: re-derived for the 3.2.0 code with TAG-01 sections 2 to 5. Interrupts:
 *   ADC_IRQHandler       T 50 us   C  9.0 us  bracketed
 *   CAN1_RX0_IRQHandler  T 222 us  C 52.0 us  charged (CanIf glue has no TMON brackets)
 *   SysTick_Handler      T 1 ms    C  3.0 us  charged
 * CAN T_k: filter bank 1 accepts 0x700-0x7FF, back to back at VN-07 5.1 minimum.
 * CAN C_k: unknown diagnostic ID 0x7E0 in service_bay_ecm_reflash.
 *
 *   Task        C_i     M_i     budget   R_i
 *   SpeedCtrl    150     257      280     343
 *   CanComm      380     539      590    1411
 *   Monitor      780    1150     1260    3627
 *   Supervisor   240     347      380    4431
 *   NvM         3900    5533     6050   26460   (all in us)
 */
#include "os_cfg.h"

const os_task_cfg_t os_task_cfg[TASK_COUNT] = {
    /*                   name          prio  period_us  deadline_us  budget_us  stack */
    [TASK_SPEEDCTRL]  = { "SpeedCtrl",  5,      1000,       1000,         280,    384 },
    [TASK_CANCOMM]    = { "CanComm",    4,      5000,       5000,         590,    512 },
    [TASK_MONITOR]    = { "Monitor",    3,     10000,      10000,        1260,    512 },
    [TASK_SUPERVISOR] = { "Supervisor", 2,     20000,      20000,         380,    256 },
    [TASK_NVM]        = { "NvM",        1,    100000,     100000,        6050,    768 },
};

/* 4 * 2^0 * (319 + 1) = 1280 LSI periods. LSI 17 to 47 kHz (datasheet):
 * 27.2 ms at 47 kHz > K = 24.4 ms (SR-WDG-01), 75.3 ms at 17 kHz <= 80 ms (SR-WDG-02) */
const os_iwdg_cfg_t os_iwdg_cfg = {
    .prescaler = 0u,
    .reload    = 319u,
};

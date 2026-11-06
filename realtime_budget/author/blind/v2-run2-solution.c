/* os_cfg.c - ECP-300 task table and independent watchdog setting
 *
 * Timing configuration of the coolant pump controller. Budgets and the IWDG
 * setting are derived and reviewed with TAG-01 (docs/); periods and deadlines
 * come from SRS-ECP300 and must not change here.
 *
 * 3.2.1: TAG-01 sections 2 to 5 redone with the 3.2.0 code and traces.
 *
 * Interrupts (C_k: largest in the three reference traces):
 *   ADC       bracketed  C =  9.0 us  T =  25 us  RCR = 0 below 900 rpm: update
 *                                                 at each over- and underflow
 *   CAN1_RX0  charged    C = 52.0 us  T = 222 us  bank 1 mask passes 0x700-0x7FF,
 *                                                 back to back, 111 bits at 500k
 *   SysTick   charged    C =  3.0 us  T =   1 ms
 *
 *   task        C_i      W_i     M_i     B_i   B/M    R_i     D_i
 *   SpeedCtrl    150     410     257     265   1.03    418    1000
 *   CanComm      380    1015     646     665   1.03   1870    5000
 *   Supervisor   240     624     399     410   1.03   2923   20000
 *   Monitor      780    1965    1254    1290   1.03   8466   10000
 *   NvM         3900    9719    6218    6400   1.03  77615  100000
 *
 * Supervisor runs above Monitor to keep the refresh interval short:
 * K = 20 ms + 2.923 ms = 22.923 ms.
 */
#include "os_cfg.h"

const os_task_cfg_t os_task_cfg[TASK_COUNT] = {
    /*                   name          prio  period_us  deadline_us  budget_us  stack */
    [TASK_SPEEDCTRL]  = { "SpeedCtrl",  5,      1000,       1000,         265,    384 },
    [TASK_CANCOMM]    = { "CanComm",    4,      5000,       5000,         665,    512 },
    [TASK_MONITOR]    = { "Monitor",    2,     10000,      10000,        1290,    512 },
    [TASK_SUPERVISOR] = { "Supervisor", 3,     20000,      20000,         410,    256 },
    [TASK_NVM]        = { "NvM",        1,    100000,     100000,        6400,    768 },
};

/* 4 * 2^0 * (303 + 1) = 1216 LSI periods, f_LSI 17 to 47 kHz (DS8626 table 35):
 * 25.87 ms at 47 kHz > K, 71.53 ms at 17 kHz <= 80 ms (38.0 ms at 32 kHz) */
const os_iwdg_cfg_t os_iwdg_cfg = {
    .prescaler = 0u,
    .reload    = 303u,
};

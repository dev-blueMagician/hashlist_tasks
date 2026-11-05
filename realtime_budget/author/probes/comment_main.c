/* main loop timing: see TAG-01 */
/* os_cfg.c - ECP-300 task table and independent watchdog setting
 *
 * 3.2.1: budgets and IWDG re-derived with TAG-01 for the 3.2 code.
 *
 * - CAN1_RX0_IRQHandler (can_if_glue.c, new in 3.2) has no TMON brackets, so
 *   its time is charged to the interrupted job, like SysTick. TAG-01
 *   appendix A (3.1, can_legacy.c bracketed) no longer holds.
 * - Its bank 1 filter (0x7DF, mask 0x700) accepts all of 0x700-0x7FF, which
 *   VN-07 4.5 lets fill the bus back to back during any ECU's reprogramming:
 *   T = 111 bit times at 500 kbit/s = 222 us, C = 52.0 us (largest in the
 *   service-bay trace, unknown IDs). The capture's 1 ms STmin is not the limit.
 * - C_i from the three reference traces (net): 150, 380, 780, 240, 3900 us.
 *   FOC 9.0 us / 50 us bracketed, SysTick 3.0 us / 1 ms charged.
 * - M_i (TAG-01 s.3) = 257, 539, 1150, 347, 5533 us; B_i = ceil(1.10 M_i).
 * - R_i with budgets (s.4): 346, 1420, 3647, 4465, 26642 us: all met.
 * - K = 20 ms + 4.47 ms = 24.47 ms. LSI 17..47 kHz (datasheet): 1280 LSI
 *   periods give 27.2 ms at 47 kHz (> K) and 75.3 ms at 17 kHz (<= 80 ms).
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

/* 4 * 2^0 * (319 + 1) = 1280 LSI periods: 27.2 ms at 47 kHz, 75.3 ms at 17 kHz */
const os_iwdg_cfg_t os_iwdg_cfg = {
    .prescaler = 0u,
    .reload    = 319u,
};

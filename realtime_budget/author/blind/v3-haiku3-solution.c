/* os_cfg.c - ECP-300 task table and independent watchdog setting
 *
 * Timing configuration of the coolant pump controller. Budgets and the IWDG
 * setting are derived and reviewed with TAG-01 (docs/); periods and deadlines
 * come from SRS-ECP300 and must not change here.
 *
 * 3.2.1: re-derived for 3.2.0 code (TAG-01, 3.2.0 traces and VN-07).
 *   - CAN1_RX0 (can_if_glue.c) is not bracketed by TMON: charged to the job.
 *     Worst case 135 bit times per 8-byte frame at 500 kbit/s = 270 us (VN-07 5.1).
 *   - Budgets are at least the TAG-01 monitored time and at least the largest
 *     job time seen in the fleet reset log (3.2.0), and within 25 % of the
 *     monitored time.
 *   - IWDG: LSI 17..47 kHz (DS_stm32f405rg Table 35). PR=0, RL=307 keeps the
 *     fastest timeout (26.2 ms) above K = 20 ms + R_sup (23.7 ms) and the
 *     slowest (72.5 ms) within 80 ms.
 */
#include "os_cfg.h"

const os_task_cfg_t os_task_cfg[TASK_COUNT] = {
    /*                   name          prio  period_us  deadline_us  budget_us  stack */
    [TASK_SPEEDCTRL]  = { "SpeedCtrl",  5,      1000,       1000,         250,    384 },
    [TASK_CANCOMM]    = { "CanComm",    4,      5000,       5000,         530,    512 },
    [TASK_MONITOR]    = { "Monitor",    3,     10000,      10000,        1150,    512 },
    [TASK_SUPERVISOR] = { "Supervisor", 2,     20000,      20000,         360,    256 },
    [TASK_NVM]        = { "NvM",        1,    100000,     100000,        5500,    768 },
};

/* t_IWDG = 4 * 2^0 * (307 + 1) / f_LSI = 38.5 ms nominal (26.2 ms at 47 kHz, 72.5 ms at 17 kHz) */
const os_iwdg_cfg_t os_iwdg_cfg = {
    .prescaler = 0u,
    .reload    = 307u,
};

/* os_cfg.c - ECP-300 task table and independent watchdog setting
 *
 * 3.2.1 (near miss: ADC interrupt taken at the 20 kHz carrier in every mode).
 *
 * CAN1_RX0 charged at T = 222 us from VN-07, LSI 17..47 kHz, as in the correct
 * answer. ADC_IRQHandler taken as T = 50 us from the 20 kHz carrier and the
 * traces (the Run table in mcal/Pwm_Cfg.c), so the LowRipple mode is missed.
 * M_i = 257, 539, 1150, 347, 5533 us; B_i = ceil(1.10 M_i).
 * K = 20 ms + 4.47 ms = 24.47 ms; 1280 LSI periods give 27.2 ms at 47 kHz and
 * 75.3 ms at 17 kHz.
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

const os_iwdg_cfg_t os_iwdg_cfg = {
    .prescaler = 0u,
    .reload    = 319u,
};

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
 *   service-bay trace, unknown IDs). The captures do not give this limit.
 * - ADC_IRQHandler: below 900 rpm (Cal.PwmModeLowEnter_rpm, inside the SRS
 *   speed range) speed_ctrl.c selects PwmConf_PwmMode_LowRipple, whose table
 *   in mcal/Pwm_Cfg.c writes 0 to 0x40010030, TIM1_RCR (the Run table writes
 *   1). TIM1 is center-aligned (CR1 0xA1), TRGO = update (CR2 0x20), and ADC1
 *   injected starts on TIM1_TRGO (ADC1_CR2 0x00110001). The repetition counter
 *   counts overflows and underflows (RM0090 17.3.3), so TRGO and the ADC run
 *   at twice the 20 kHz carrier: T = 25 us, C = 9.0 us, bracketed. No trace
 *   runs below 1800 rpm. SysTick 3.0 us / 1 ms charged.
 * - C_i from the three reference traces (net): 150, 380, 780, 240, 3900 us.
 * - M_i (TAG-01 s.3) = 257, 646, 1254, 399, 6218 us. At 8 % above M_i NvM
 *   misses its deadline, and the watchdog window closes soon after, so the
 *   budgets stay close to M_i: B_i = ceil(1.02 M_i).
 * - R_i with budgets (s.4): 416, 1860, 6941, 7989, 69641 us: all met.
 * - K = 20 ms + 7.99 ms = 27.99 ms. LSI 17..47 kHz (datasheet): 1344 LSI
 *   periods give 28.6 ms at 47 kHz (> K) and 79.1 ms at 17 kHz (<= 80 ms).
 */
#include "os_cfg.h"

const os_task_cfg_t os_task_cfg[TASK_COUNT] = {
    /*                   name          prio  period_us  deadline_us  budget_us  stack */
    [TASK_SPEEDCTRL]  = { "SpeedCtrl",  5,      1000,       1000,         263,    384 },
    [TASK_CANCOMM]    = { "CanComm",    4,      5000,       5000,         659,    512 },
    [TASK_MONITOR]    = { "Monitor",    3,     10000,      10000,        1280,    512 },
    [TASK_SUPERVISOR] = { "Supervisor", 2,     20000,      20000,         407,    256 },
    [TASK_NVM]        = { "NvM",        1,    100000,     100000,        6343,    768 },
};

/* 4 * 2^0 * (335 + 1) = 1344 LSI periods: 28.6 ms at 47 kHz, 79.1 ms at 17 kHz */
const os_iwdg_cfg_t os_iwdg_cfg = {
    .prescaler = 0u,
    .reload    = 335u,
};

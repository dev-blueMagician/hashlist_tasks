/* iwdg.c - independent watchdog
 *
 * Clocked by the LSI RC oscillator. Started once from main() before the
 * scheduler; refreshed only by the Supervisor task (tasks.c).
 */
#include "stm32f4xx.h"
#include "os_cfg.h"
#include "iwdg.h"

void iwdg_start(void)
{
    DBGMCU->APB1FZ |= DBGMCU_APB1_FZ_DBG_IWDG_STOP;    /* halt with the core in the debugger */
    IWDG->KR = 0x5555u;                                /* enable access to PR and RLR */
    IWDG->PR = os_iwdg_cfg.prescaler;
    IWDG->RLR = os_iwdg_cfg.reload;
    while (IWDG->SR != 0u) { }                         /* PVU, RVU: wait for the LSI domain */
    IWDG->KR = 0xAAAAu;                                /* load the counter */
    IWDG->KR = 0xCCCCu;                                /* start */
}

void iwdg_kick(void)
{
    IWDG->KR = 0xAAAAu;
}

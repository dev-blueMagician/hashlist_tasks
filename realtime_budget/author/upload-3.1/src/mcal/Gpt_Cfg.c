/*==========================================================================
 * Gpt_Cfg.c
 * GPT driver configuration
 * GptConfigurator 4.1.2 (MCAL STM32F4 R4.2.2)
 * Generated on 2026-05-28 14:02:11 from ECP300_MCAL.mcfg rev 41. Do not edit.
 *==========================================================================*/
#include "Gpt_Cfg.h"

/* GptChannel_FreeRun: 32-bit free-running time base for the speed
 * observer and diagnostics. Polled, no notification. */

static const Mcal_RegInitType Gpt_InitRegs[] = {
    { 0x40000000u, 0x00000000u },   /*  0 */
    { 0x4000000Cu, 0x00000000u },   /*  1 */
    { 0x40000028u, 0x00000053u },   /*  2 */
    { 0x4000002Cu, 0xFFFFFFFFu },   /*  3 */
    { 0x40000014u, 0x00000001u },   /*  4 */
    { 0x40000000u, 0x00000001u },   /*  5 */
};

const Gpt_ConfigType Gpt_Config = { MCAL_SEQ(Gpt_InitRegs), 1000000u };

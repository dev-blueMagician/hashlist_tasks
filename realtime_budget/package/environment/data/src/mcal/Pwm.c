/*==========================================================================
 * Pwm.c
 * PWM driver
 * MCAL STM32F4 R4.2.2, static code
 * Generated on 2026-05-28 14:02:11 from ECP300_MCAL.mcfg rev 41. Do not edit.
 *==========================================================================*/
#include "Pwm.h"
#include "Pwm_Cfg.h"
#include "Det.h"

#define PWM_CCR(ch)   (*(volatile uint32 *)(PWM_HW_UNIT_0_BASE + 0x34u + 4u * (ch)))

static const Pwm_ConfigType *Pwm_CfgPtr;
static Pwm_ModeType Pwm_CurrentMode = PwmConf_PwmMode_Count;

static void Pwm_WriteSeq(const Mcal_RegSeqType *seq)
{
    for (uint16 i = 0u; i < seq->count; i++)
        *(volatile uint32 *)seq->regs[i].addr = seq->regs[i].value;
}

void Pwm_Init(const Pwm_ConfigType *cfg)
{
    Pwm_CfgPtr = cfg;
    Pwm_WriteSeq(&cfg->init);
    Pwm_WriteSeq(&cfg->mode[PwmConf_PwmMode_Off]);
    Pwm_CurrentMode = PwmConf_PwmMode_Off;
    Pwm_WriteSeq(&cfg->start);
}

/* Takes effect at the next update event of the timer (preloaded registers). */
Std_ReturnType Pwm_SetMode(Pwm_ModeType mode)
{
    if (Pwm_CfgPtr == NULL_PTR || mode >= PwmConf_PwmMode_Count) {
        Det_ReportError(PWM_MODULE_ID, 0u, PWM_SETMODE_SID, PWM_E_PARAM_MODE);
        return E_NOT_OK;
    }
    if (mode != Pwm_CurrentMode) {
        Pwm_WriteSeq(&Pwm_CfgPtr->mode[mode]);
        Pwm_CurrentMode = mode;
    }
    return E_OK;
}

Pwm_ModeType Pwm_GetMode(void)
{
    return Pwm_CurrentMode;
}

/* Used outside the current loop only (alignment, braking). The current loop
 * writes the compare registers directly from ADC_IRQHandler. */
void Pwm_SetDutyCycles(uint16 a, uint16 b, uint16 c)
{
    PWM_CCR(0u) = a;
    PWM_CCR(1u) = b;
    PWM_CCR(2u) = c;
}

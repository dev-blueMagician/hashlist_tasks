/*==========================================================================
 * Pwm_Cfg.h
 * PWM driver configuration
 * PwmConfigurator 4.1.2 (MCAL STM32F4 R4.2.2)
 * Generated on 2026-05-28 14:02:11 from ECP300_MCAL.mcfg rev 41. Do not edit.
 *==========================================================================*/
#ifndef PWM_CFG_H
#define PWM_CFG_H

#include "Mcal_Types.h"

#define PWM_HW_UNIT_0_BASE       0x40010000u
#define PWM_CHANNEL_COUNT        3u

typedef enum {
    PwmConf_PwmMode_Off = 0,
    PwmConf_PwmMode_Align = 1,
    PwmConf_PwmMode_Run = 2,
    PwmConf_PwmMode_LowRipple = 3,
    PwmConf_PwmMode_Brake = 4,
    PwmConf_PwmMode_Count
} Pwm_ModeType;

typedef struct {
    Mcal_RegSeqType init;
    Mcal_RegSeqType start;
    Mcal_RegSeqType mode[PwmConf_PwmMode_Count];
} Pwm_ConfigType;

extern const Pwm_ConfigType Pwm_Config;

#endif

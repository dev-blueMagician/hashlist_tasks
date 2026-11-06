/*==========================================================================
 * Pwm_Cfg.c
 * PWM driver configuration
 * PwmConfigurator 4.1.2 (MCAL STM32F4 R4.2.2)
 * Generated on 2026-05-28 14:02:11 from ECP300_MCAL.mcfg rev 41. Do not edit.
 *==========================================================================*/
#include "Pwm_Cfg.h"

static const Mcal_RegInitType Pwm_InitRegs[] = {
    { 0x40010000u, 0x00000000u },   /*  0 */
    { 0x40010004u, 0x00000020u },   /*  1 */
    { 0x40010008u, 0x00000000u },   /*  2 */
    { 0x4001000Cu, 0x00000000u },   /*  3 */
    { 0x40010018u, 0x00006868u },   /*  4 */
    { 0x4001001Cu, 0x00006868u },   /*  5 */
    { 0x40010020u, 0x00000000u },   /*  6 */
    { 0x40010028u, 0x00000000u },   /*  7 */
    { 0x4001002Cu, 0x00001068u },   /*  8 */
    { 0x40010030u, 0x00000001u },   /*  9 */
    { 0x40010034u, 0x00000834u },   /* 10 */
    { 0x40010038u, 0x00000834u },   /* 11 */
    { 0x4001003Cu, 0x00000834u },   /* 12 */
    { 0x40010040u, 0x00001067u },   /* 13 */
    { 0x40010044u, 0x00000C54u },   /* 14 */
};

static const Mcal_RegInitType Pwm_StartRegs[] = {
    { 0x40010014u, 0x00000001u },   /*  0 */
    { 0x40010000u, 0x000000A1u },   /*  1 */
};

static const Mcal_RegInitType Pwm_ModeOffRegs[] = {
    { 0x40010044u, 0x00000C54u },   /*  0 */
    { 0x40010020u, 0x00000000u },   /*  1 */
};

static const Mcal_RegInitType Pwm_ModeAlignRegs[] = {
    { 0x40010004u, 0x00000020u },   /*  0 */
    { 0x40010020u, 0x00001555u },   /*  1 */
    { 0x40010030u, 0x00000001u },   /*  2 */
    { 0x40010040u, 0x00001067u },   /*  3 */
    { 0x40010044u, 0x00008C54u },   /*  4 */
};

static const Mcal_RegInitType Pwm_ModeRunRegs[] = {
    { 0x40010004u, 0x00000020u },   /*  0 */
    { 0x40010020u, 0x00001555u },   /*  1 */
    { 0x40010030u, 0x00000001u },   /*  2 */
    { 0x40010040u, 0x00001067u },   /*  3 */
    { 0x40010044u, 0x00008C54u },   /*  4 */
};

static const Mcal_RegInitType Pwm_ModeLowRippleRegs[] = {
    { 0x40010004u, 0x00000020u },   /*  0 */
    { 0x40010020u, 0x00001555u },   /*  1 */
    { 0x40010030u, 0x00000000u },   /*  2 */
    { 0x40010040u, 0x00001067u },   /*  3 */
    { 0x40010044u, 0x00008C3Cu },   /*  4 */
};

static const Mcal_RegInitType Pwm_ModeBrakeRegs[] = {
    { 0x40010034u, 0x00000000u },   /*  0 */
    { 0x40010038u, 0x00000000u },   /*  1 */
    { 0x4001003Cu, 0x00000000u },   /*  2 */
    { 0x40010020u, 0x00001555u },   /*  3 */
    { 0x40010030u, 0x00000001u },   /*  4 */
    { 0x40010044u, 0x00008C54u },   /*  5 */
};

const Pwm_ConfigType Pwm_Config = {
    MCAL_SEQ(Pwm_InitRegs),
    MCAL_SEQ(Pwm_StartRegs),
    {
        MCAL_SEQ(Pwm_ModeOffRegs),
        MCAL_SEQ(Pwm_ModeAlignRegs),
        MCAL_SEQ(Pwm_ModeRunRegs),
        MCAL_SEQ(Pwm_ModeLowRippleRegs),
        MCAL_SEQ(Pwm_ModeBrakeRegs),
    },
};

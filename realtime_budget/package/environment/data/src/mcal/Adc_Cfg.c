/*==========================================================================
 * Adc_Cfg.c
 * ADC driver configuration
 * AdcConfigurator 4.1.2 (MCAL STM32F4 R4.2.2)
 * Generated on 2026-05-28 14:02:11 from ECP300_MCAL.mcfg rev 41. Do not edit.
 *==========================================================================*/
#include "Adc_Cfg.h"

static const Mcal_RegInitType Adc_InitRegs[] = {
    { 0x40012304u, 0x00010005u },   /*  0 */
    { 0x40012004u, 0x00000180u },   /*  1 */
    { 0x40012010u, 0x00000049u },   /*  2 */
    { 0x40012038u, 0x00110000u },   /*  3 */
    { 0x40012008u, 0x00110001u },   /*  4 */
    { 0x40012104u, 0x00000100u },   /*  5 */
    { 0x40012110u, 0x00000049u },   /*  6 */
    { 0x40012138u, 0x00008000u },   /*  7 */
    { 0x40012108u, 0x00000001u },   /*  8 */
    { 0x40012204u, 0x00000100u },   /*  9 */
    { 0x4001220Cu, 0x00000000u },   /* 10 */
    { 0x40012210u, 0x00000FFFu },   /* 11 */
    { 0x4001222Cu, 0x00300000u },   /* 12 */
    { 0x40012234u, 0x0006B16Au },   /* 13 */
    { 0x40012208u, 0x00000401u },   /* 14 */
};

const Adc_ConfigType Adc_Config = {
    MCAL_SEQ(Adc_InitRegs),
    {   /* group, hw unit, channels, trigger */
        { AdcConf_AdcGroup_PhaseCurrents, 0u, 2u, ADC_TRIGG_SRC_HW },
        { AdcConf_AdcGroup_PhaseB,        1u, 1u, ADC_TRIGG_SRC_HW },
        { AdcConf_AdcGroup_Temperatures,  2u, 4u, ADC_TRIGG_SRC_SW },
    },
};

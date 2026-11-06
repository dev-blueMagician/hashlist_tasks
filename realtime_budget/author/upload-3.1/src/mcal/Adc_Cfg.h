/*==========================================================================
 * Adc_Cfg.h
 * ADC driver configuration
 * AdcConfigurator 4.1.2 (MCAL STM32F4 R4.2.2)
 * Generated on 2026-05-28 14:02:11 from ECP300_MCAL.mcfg rev 41. Do not edit.
 *==========================================================================*/
#ifndef ADC_CFG_H
#define ADC_CFG_H

#include "Mcal_Types.h"

#define ADC_TRIGG_SRC_SW   0u
#define ADC_TRIGG_SRC_HW   1u

typedef enum {
    AdcConf_AdcGroup_PhaseCurrents = 0,
    AdcConf_AdcGroup_PhaseB,
    AdcConf_AdcGroup_Temperatures,
    AdcConf_AdcGroup_Count
} Adc_GroupType;

typedef struct {
    Adc_GroupType group;
    uint8 hwUnit;
    uint8 channels;
    uint8 triggerSource;
} Adc_GroupDefType;

typedef struct {
    Mcal_RegSeqType init;
    Adc_GroupDefType groups[AdcConf_AdcGroup_Count];
} Adc_ConfigType;

extern const Adc_ConfigType Adc_Config;

#endif

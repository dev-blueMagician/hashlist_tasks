/*==========================================================================
 * NvM_Cfg.c
 * NVRAM manager configuration
 * NvMConfigurator 4.2.0 (BSW R4.2.2)
 * Generated on 2026-05-28 14:02:11 from ECP300_MCAL.mcfg rev 41. Do not edit.
 *==========================================================================*/
#include "NvM_Cfg.h"
#include "Fee_Cfg.h"

/* block id, length, FEE block, CRC, write once, immediate, priority */
const NvM_BlockDescriptorType NvM_BlockDescriptorTable[NVM_TOTAL_NUMBER_OF_NVRAM_BLOCKS] = {
    {  1u,    4u, FeeConf_FeeBlock_NvMConfig,             NVM_CRC16, FALSE, FALSE, 127u },   /* NvMConfig */
    {  2u,   64u, FeeConf_FeeBlock_EcuIdentification,     NVM_CRC16, TRUE , FALSE, 127u },   /* EcuIdentification */
    {  3u,   20u, FeeConf_FeeBlock_VinData,               NVM_CRC16, TRUE , FALSE, 127u },   /* VinData */
    {  4u,    4u, FeeConf_FeeBlock_HwVariant,             NVM_CRC16, TRUE , FALSE, 127u },   /* HwVariant */
    {  5u,    8u, FeeConf_FeeBlock_CalibrationSelect,     NVM_CRC16, FALSE, FALSE, 127u },   /* CalibrationSelect */
    {  6u,    8u, FeeConf_FeeBlock_OperatingHours,        NVM_CRC16, FALSE, FALSE, 127u },   /* OperatingHours */
    {  7u,    4u, FeeConf_FeeBlock_StartCounter,          NVM_CRC16, FALSE, FALSE, 127u },   /* StartCounter */
    {  8u,   32u, FeeConf_FeeBlock_ResetCounters,         NVM_CRC16, FALSE, TRUE ,   1u },   /* ResetCounters */
    {  9u,   96u, FeeConf_FeeBlock_ResetFreezeFrame,      NVM_CRC16, FALSE, TRUE ,   1u },   /* ResetFreezeFrame */
    { 10u,   80u, FeeConf_FeeBlock_TmonStatistics,        NVM_CRC16, FALSE, FALSE, 127u },   /* TmonStatistics */
    { 11u,  128u, FeeConf_FeeBlock_SpeedHistogram,        NVM_CRC16, FALSE, FALSE, 127u },   /* SpeedHistogram */
    { 12u,  128u, FeeConf_FeeBlock_TempHistogramStage,    NVM_CRC16, FALSE, FALSE, 127u },   /* TempHistogramStage */
    { 13u,  128u, FeeConf_FeeBlock_TempHistogramWinding,  NVM_CRC16, FALSE, FALSE, 127u },   /* TempHistogramWinding */
    { 14u,  128u, FeeConf_FeeBlock_TempHistogramCoolant,  NVM_CRC16, FALSE, FALSE, 127u },   /* TempHistogramCoolant */
    { 15u,   64u, FeeConf_FeeBlock_VdcHistogram,          NVM_CRC16, FALSE, FALSE, 127u },   /* VdcHistogram */
    { 16u,   32u, FeeConf_FeeBlock_DeratingCounters,      NVM_CRC16, FALSE, FALSE, 127u },   /* DeratingCounters */
    { 17u,   16u, FeeConf_FeeBlock_StallCounters,         NVM_CRC16, FALSE, FALSE, 127u },   /* StallCounters */
    { 18u,   16u, FeeConf_FeeBlock_BrakeCounters,         NVM_CRC16, FALSE, FALSE, 127u },   /* BrakeCounters */
    { 19u,   48u, FeeConf_FeeBlock_CanStatistics,         NVM_CRC16, FALSE, FALSE, 127u },   /* CanStatistics */
    { 20u,   24u, FeeConf_FeeBlock_ObserverLearnValues,   NVM_CRC16, FALSE, FALSE, 127u },   /* ObserverLearnValues */
    { 21u,   16u, FeeConf_FeeBlock_CurrentOffsetLearn,    NVM_CRC16, FALSE, FALSE, 127u },   /* CurrentOffsetLearn */
    { 22u,   64u, FeeConf_FeeBlock_AfterRunLog,           NVM_CRC16, FALSE, FALSE, 127u },   /* AfterRunLog */
    { 23u,   48u, FeeConf_FeeBlock_ProgrammingInfo,       NVM_CRC16, FALSE, FALSE, 127u },   /* ProgrammingInfo */
    { 24u,   32u, FeeConf_FeeBlock_FingerprintApp,        NVM_CRC16, FALSE, FALSE, 127u },   /* FingerprintApp */
    { 25u,   32u, FeeConf_FeeBlock_FingerprintCal,        NVM_CRC16, FALSE, FALSE, 127u },   /* FingerprintCal */
};

/* Emulated EEPROM: two 16 KB sectors (sector 1 and 2), 1224 bytes of block data. */
const Fee_SectorType Fee_Sectors[2] = {
    { 0x08004000u, 0x4000u },
    { 0x08008000u, 0x4000u },
};

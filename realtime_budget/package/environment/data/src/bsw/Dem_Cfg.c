/*==========================================================================
 * Dem_Cfg.c
 * Diagnostic event manager configuration
 * DemConfigurator 4.2.0 (BSW R4.2.2)
 * Generated on 2026-05-28 14:02:11 from ECP300_MCAL.mcfg rev 41. Do not edit.
 *==========================================================================*/
#include "Dem_Cfg.h"

/* event, DTC, debounce class, freeze frame class, operation cycle, reporting task */
const Dem_EventParameterType Dem_EventParameter[DEM_NUMBER_OF_EVENTS] = {
    { DemConf_DemEventParameter_MotorPositionSensorPerf,   0x0A0100u, DEM_DEBOUNCE_MONITOR_INTERNAL, DemFreezeFrameClass_Motor, DEM_OPCYC_POWER, /* SpeedCtrl */ },
    { DemConf_DemEventParameter_MotorStartFailure,         0x0A0F00u, DEM_DEBOUNCE_MONITOR_INTERNAL, DemFreezeFrameClass_Motor, DEM_OPCYC_POWER, /* SpeedCtrl */ },
    { DemConf_DemEventParameter_MotorControlModulePerf,    0x0A1B00u, DEM_DEBOUNCE_COUNTER,          DemFreezeFrameClass_Motor, DEM_OPCYC_POWER, /* Monitor */ },
    { DemConf_DemEventParameter_WindingTempSensorRange,    0x0A2A00u, DEM_DEBOUNCE_COUNTER,          DemFreezeFrameClass_Motor, DEM_OPCYC_POWER, /* Monitor */ },
    { DemConf_DemEventParameter_WindingTempHigh,           0x0A2B00u, DEM_DEBOUNCE_COUNTER,          DemFreezeFrameClass_Motor, DEM_OPCYC_POWER, /* Monitor */ },
    { DemConf_DemEventParameter_PowerStageTempHigh,        0x0A3C00u, DEM_DEBOUNCE_COUNTER,          DemFreezeFrameClass_Motor, DEM_OPCYC_POWER, /* Monitor */ },
    { DemConf_DemEventParameter_PowerStageTempSensorRange, 0x0A3D00u, DEM_DEBOUNCE_COUNTER,          DemFreezeFrameClass_Motor, DEM_OPCYC_POWER, /* Monitor */ },
    { DemConf_DemEventParameter_MotorOverspeed,            0x0A4400u, DEM_DEBOUNCE_MONITOR_INTERNAL, DemFreezeFrameClass_Motor, DEM_OPCYC_POWER, /* SpeedCtrl */ },
    { DemConf_DemEventParameter_MotorStall,                0x0A4500u, DEM_DEBOUNCE_MONITOR_INTERNAL, DemFreezeFrameClass_Motor, DEM_OPCYC_POWER, /* SpeedCtrl */ },
    { DemConf_DemEventParameter_InverterPerf,              0x0A7800u, DEM_DEBOUNCE_COUNTER,          DemFreezeFrameClass_Motor, DEM_OPCYC_POWER, /* Monitor */ },
    { DemConf_DemEventParameter_GateDriverFault,           0x0A7A00u, DEM_DEBOUNCE_COUNTER,          DemFreezeFrameClass_Motor, DEM_OPCYC_POWER, /* Monitor */ },
    { DemConf_DemEventParameter_PhaseAOpen,                0x0A9000u, DEM_DEBOUNCE_COUNTER,          DemFreezeFrameClass_Motor, DEM_OPCYC_POWER, /* Monitor */ },
    { DemConf_DemEventParameter_PhaseBOpen,                0x0A9100u, DEM_DEBOUNCE_COUNTER,          DemFreezeFrameClass_Motor, DEM_OPCYC_POWER, /* Monitor */ },
    { DemConf_DemEventParameter_PhaseCOpen,                0x0A9200u, DEM_DEBOUNCE_COUNTER,          DemFreezeFrameClass_Motor, DEM_OPCYC_POWER, /* Monitor */ },
    { DemConf_DemEventParameter_PhaseCurrentSensorA,       0x0A9300u, DEM_DEBOUNCE_COUNTER,          DemFreezeFrameClass_Motor, DEM_OPCYC_POWER, /* Monitor */ },
    { DemConf_DemEventParameter_PhaseCurrentSensorB,       0x0A9400u, DEM_DEBOUNCE_COUNTER,          DemFreezeFrameClass_Motor, DEM_OPCYC_POWER, /* Monitor */ },
    { DemConf_DemEventParameter_DcLinkVoltageLow,          0x0C2900u, DEM_DEBOUNCE_COUNTER,          DemFreezeFrameClass_Motor, DEM_OPCYC_POWER, /* Monitor */ },
    { DemConf_DemEventParameter_DcLinkVoltageHigh,         0x0C2A00u, DEM_DEBOUNCE_COUNTER,          DemFreezeFrameClass_Motor, DEM_OPCYC_POWER, /* Monitor */ },
    { DemConf_DemEventParameter_DcLinkVoltageSensor,       0x0C2B00u, DEM_DEBOUNCE_COUNTER,          DemFreezeFrameClass_Motor, DEM_OPCYC_POWER, /* Monitor */ },
    { DemConf_DemEventParameter_CoolantPumpControlOpen,    0x260000u, DEM_DEBOUNCE_COUNTER,          DemFreezeFrameClass_Motor, DEM_OPCYC_POWER, /* Monitor */ },
    { DemConf_DemEventParameter_CoolantPumpControlRange,   0x260100u, DEM_DEBOUNCE_COUNTER,          DemFreezeFrameClass_Motor, DEM_OPCYC_POWER, /* Monitor */ },
    { DemConf_DemEventParameter_CoolantPumpControlLow,     0x260200u, DEM_DEBOUNCE_COUNTER,          DemFreezeFrameClass_Motor, DEM_OPCYC_POWER, /* Monitor */ },
    { DemConf_DemEventParameter_CoolantPumpControlHigh,    0x260300u, DEM_DEBOUNCE_COUNTER,          DemFreezeFrameClass_Motor, DEM_OPCYC_POWER, /* Monitor */ },
    { DemConf_DemEventParameter_CoolantPumpBPerf,          0x261A00u, DEM_DEBOUNCE_COUNTER,          DemFreezeFrameClass_Motor, DEM_OPCYC_POWER, /* Monitor */ },
    { DemConf_DemEventParameter_CoolantOverTemp,           0x021700u, DEM_DEBOUNCE_COUNTER,          DemFreezeFrameClass_Motor, DEM_OPCYC_POWER, /* Monitor */ },
    { DemConf_DemEventParameter_SupplyVoltageLow,          0x056200u, DEM_DEBOUNCE_COUNTER,          DemFreezeFrameClass_Motor, DEM_OPCYC_POWER, /* Monitor */ },
    { DemConf_DemEventParameter_SupplyVoltageHigh,         0x056300u, DEM_DEBOUNCE_COUNTER,          DemFreezeFrameClass_Motor, DEM_OPCYC_POWER, /* Monitor */ },
    { DemConf_DemEventParameter_RomChecksum,               0x060100u, DEM_DEBOUNCE_MONITOR_INTERNAL, DemFreezeFrameClass_Ecu,   DEM_OPCYC_POWER, /* Supervisor */ },
    { DemConf_DemEventParameter_RamError,                  0x060400u, DEM_DEBOUNCE_MONITOR_INTERNAL, DemFreezeFrameClass_Ecu,   DEM_OPCYC_POWER, /* Supervisor */ },
    { DemConf_DemEventParameter_ProcessorFault,            0x060600u, DEM_DEBOUNCE_MONITOR_INTERNAL, DemFreezeFrameClass_Ecu,   DEM_OPCYC_POWER, /* Supervisor */ },
    { DemConf_DemEventParameter_ControlModulePerf,         0x060700u, DEM_DEBOUNCE_MONITOR_INTERNAL, DemFreezeFrameClass_Ecu,   DEM_OPCYC_POWER, /* Supervisor */ },
    { DemConf_DemEventParameter_EepromError,               0x062F00u, DEM_DEBOUNCE_MONITOR_INTERNAL, DemFreezeFrameClass_Ecu,   DEM_OPCYC_POWER, /* NvM */ },
    { DemConf_DemEventParameter_VinNotProgrammed,          0x063000u, DEM_DEBOUNCE_MONITOR_INTERNAL, DemFreezeFrameClass_Ecu,   DEM_OPCYC_POWER, /* NvM */ },
    { DemConf_DemEventParameter_HvilCircuit,               0x0A0A00u, DEM_DEBOUNCE_COUNTER,          DemFreezeFrameClass_Motor, DEM_OPCYC_POWER, /* Monitor */ },
    { DemConf_DemEventParameter_CanBusHigh,                0xC00100u, DEM_DEBOUNCE_COUNTER,          DemFreezeFrameClass_Ecu,   DEM_OPCYC_POWER, /* CanComm */ },
    { DemConf_DemEventParameter_CanBusOff,                 0xC07300u, DEM_DEBOUNCE_COUNTER,          DemFreezeFrameClass_Ecu,   DEM_OPCYC_POWER, /* CanComm */ },
    { DemConf_DemEventParameter_LostCommEcm,               0xC10000u, DEM_DEBOUNCE_COUNTER,          DemFreezeFrameClass_Ecu,   DEM_OPCYC_POWER, /* CanComm */ },
    { DemConf_DemEventParameter_LostCommTcm,               0xC10100u, DEM_DEBOUNCE_COUNTER,          DemFreezeFrameClass_Ecu,   DEM_OPCYC_POWER, /* CanComm */ },
    { DemConf_DemEventParameter_LostCommBcm,               0xC14000u, DEM_DEBOUNCE_COUNTER,          DemFreezeFrameClass_Ecu,   DEM_OPCYC_POWER, /* CanComm */ },
    { DemConf_DemEventParameter_LostCommCluster,           0xC15500u, DEM_DEBOUNCE_COUNTER,          DemFreezeFrameClass_Ecu,   DEM_OPCYC_POWER, /* CanComm */ },
    { DemConf_DemEventParameter_LostCommHvac,              0xC16400u, DEM_DEBOUNCE_COUNTER,          DemFreezeFrameClass_Ecu,   DEM_OPCYC_POWER, /* CanComm */ },
    { DemConf_DemEventParameter_LostCommHybridCtrl,        0xC29300u, DEM_DEBOUNCE_COUNTER,          DemFreezeFrameClass_Ecu,   DEM_OPCYC_POWER, /* CanComm */ },
    { DemConf_DemEventParameter_InvalidDataEcm,            0xC40100u, DEM_DEBOUNCE_COUNTER,          DemFreezeFrameClass_Ecu,   DEM_OPCYC_POWER, /* CanComm */ },
    { DemConf_DemEventParameter_InvalidDataAbs,            0xC41500u, DEM_DEBOUNCE_COUNTER,          DemFreezeFrameClass_Ecu,   DEM_OPCYC_POWER, /* CanComm */ },
    { DemConf_DemEventParameter_InvalidDataBcm,            0xC42200u, DEM_DEBOUNCE_COUNTER,          DemFreezeFrameClass_Ecu,   DEM_OPCYC_POWER, /* CanComm */ },
    { DemConf_DemEventParameter_SetpointTimeout,           0xD00000u, DEM_DEBOUNCE_COUNTER,          DemFreezeFrameClass_Ecu,   DEM_OPCYC_POWER, /* CanComm */ },
    { DemConf_DemEventParameter_ControlModuleSwFault,      0xF00000u, DEM_DEBOUNCE_MONITOR_INTERNAL, DemFreezeFrameClass_Ecu,   DEM_OPCYC_POWER, /* Supervisor */ },
    { DemConf_DemEventParameter_ControlModuleShutdown,     0xF00100u, DEM_DEBOUNCE_MONITOR_INTERNAL, DemFreezeFrameClass_Ecu,   DEM_OPCYC_POWER, /* Supervisor */ },
    { DemConf_DemEventParameter_EcuInternalFault,          0x900000u, DEM_DEBOUNCE_MONITOR_INTERNAL, DemFreezeFrameClass_Ecu,   DEM_OPCYC_POWER, /* Supervisor */ },
    { DemConf_DemEventParameter_TmonOverrun,               0x900100u, DEM_DEBOUNCE_MONITOR_INTERNAL, DemFreezeFrameClass_Ecu,   DEM_OPCYC_POWER, /* Supervisor */ },
    { DemConf_DemEventParameter_WatchdogReset,             0x900200u, DEM_DEBOUNCE_MONITOR_INTERNAL, DemFreezeFrameClass_Ecu,   DEM_OPCYC_POWER, /* Supervisor */ },
    { DemConf_DemEventParameter_StackOverflow,             0x900300u, DEM_DEBOUNCE_MONITOR_INTERNAL, DemFreezeFrameClass_Ecu,   DEM_OPCYC_POWER, /* Supervisor */ },
    { DemConf_DemEventParameter_AliveSupervision,          0x900400u, DEM_DEBOUNCE_MONITOR_INTERNAL, DemFreezeFrameClass_Ecu,   DEM_OPCYC_POWER, /* Supervisor */ },
    { DemConf_DemEventParameter_ClockMonitor,              0x900500u, DEM_DEBOUNCE_MONITOR_INTERNAL, DemFreezeFrameClass_Ecu,   DEM_OPCYC_POWER, /* Supervisor */ },
};

const Dem_FreezeFrameClassType DemFreezeFrameClass_Motor = {
    { DID_MOTOR_SPEED, DID_PHASE_CURRENT_RMS, DID_DC_LINK_VOLTAGE, DID_TEMP_STAGE,
      DID_TEMP_WINDING, DID_TEMP_COOLANT, DID_PWM_MODE, DID_OPERATING_HOURS }, 8u
};

const Dem_FreezeFrameClassType DemFreezeFrameClass_Ecu = {
    { DID_OPERATING_HOURS, DID_RESET_CAUSE, DID_TMON_TASK, DID_TMON_MEASURED,
      DID_TMON_BUDGET, DID_CAN_RX_LAST_100MS, DID_SW_VERSION, DID_SUPPLY_VOLTAGE }, 8u
};

const Dem_DebounceCounterClassType Dem_DebounceCounterClass = {
    CAL_REF(DtcDebounceUp), CAL_REF(DtcDebounceDown), CAL_REF(DtcDebounceLimit)
};

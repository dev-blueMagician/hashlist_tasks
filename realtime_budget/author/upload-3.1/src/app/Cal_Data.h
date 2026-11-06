/* Cal_Data.h - calibration parameters (flash, page CAL) */
#ifndef CAL_DATA_H
#define CAL_DATA_H

#include <stdint.h>

typedef int32_t int32;

typedef struct {
    int32 SpdMin_rpm;                  /* lowest commanded speed in operation */
    int32 SpdMax_rpm;                  /* highest commanded speed */
    int32 SpdStart_rpm;                /* open-loop ramp target, observer hand-over */
    int32 SpdRampUp_rpm_per_s;         /* setpoint ramp, accelerating */
    int32 SpdRampDown_rpm_per_s;       /* setpoint ramp, decelerating */
    int32 SpdPi_Kp_q12;                /* speed PI proportional gain, Q12 */
    int32 SpdPi_Ki_q12;                /* speed PI integral gain per ms, Q12 */
    int32 SpdPi_IqMax_mA;              /* q-axis current limit */
    int32 SpdStall_ms;                 /* no speed above SpdMin within this time: stall */
    int32 AlignTime_ms;                /* rotor alignment before the open-loop ramp */
    int32 AlignCurrent_mA;             /* d-axis current during alignment */
    int32 OpenLoopAccel_rpm_per_s;     /* open-loop ramp rate */
    int32 ObsGain_q12;                 /* flux observer gain, Q12 */
    int32 ObsLockTol_rpm;              /* observer/ramp mismatch accepted at hand-over */
    int32 PwmModeLowEnter_rpm;         /* PwmConf_PwmMode_LowRipple below this speed */
    int32 PwmModeLowExit_rpm;          /* back to PwmConf_PwmMode_Run above this speed */
    int32 FieldWeakStart_rpm;          /* field weakening starts */
    int32 FieldWeakIdMin_mA;           /* most negative d-axis current */
    int32 BrakeTime_ms;                /* active braking after a stop request */
    int32 VdcMin_mV;                   /* undervoltage cut-off */
    int32 VdcMax_mV;                   /* overvoltage cut-off */
    int32 VdcDerateStart_mV;           /* power derating below this voltage */
    int32 TempStageDerate_dC;          /* power stage derating start, 0.1 degC */
    int32 TempStageTrip_dC;            /* power stage trip, 0.1 degC */
    int32 TempWindDerate_dC;           /* winding derating start, 0.1 degC */
    int32 TempWindTrip_dC;             /* winding trip, 0.1 degC */
    int32 TempCoolantMax_dC;           /* coolant over-temperature DTC, 0.1 degC */
    int32 DtcDebounceUp;               /* debounce counter step on a failed check */
    int32 DtcDebounceDown;             /* debounce counter step on a passed check */
    int32 DtcDebounceLimit;            /* debounce counter limit */
    int32 CanTimeout_ms;               /* setpoint message timeout */
    int32 CanFallback_rpm;             /* speed without a valid setpoint */
    int32 NvmFreezeFrameMax;           /* freeze frames kept per DTC */
    int32 AfterRunTime_s;              /* after-run time after ignition off */
    int32 AfterRun_rpm;                /* after-run speed */
} Cal_DataType;

extern const Cal_DataType Cal;

#endif

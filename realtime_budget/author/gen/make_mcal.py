"""Write the generated-looking MCAL configuration and the speed control sources.

Author-only. The low-speed PWM mode is the deciding load of this task: its
table writes TIM1_RCR = 0, so in center-aligned mode the update event (TRGO,
the ADC injected trigger) comes at each overflow and underflow, every 25 us.
All register writes are raw address/value pairs, as a configurator emits
them, so the solver has to decode them with RM0090.

usage: python -I make_mcal.py PACKAGE_DIR
"""
import os
import sys

TIM1, TIM2 = 0x40010000, 0x40000000
ADC1, ADC2, ADC3, ADC_COMMON = 0x40012000, 0x40012100, 0x40012200, 0x40012300
GPIO = {"A": 0x40020000, "B": 0x40020400, "C": 0x40020800}

STAMP = "Generated on 2026-05-28 14:02:11 from ECP300_MCAL.mcfg rev 41. Do not edit."


def hdr(name, tool, what):
    return ("/*" + "=" * 74 + "\n"
            " * %s\n * %s\n * %s\n * %s\n" % (name, what, tool, STAMP)
            + " *" + "=" * 74 + "*/\n")


def table(cname, rows):
    out = ["static const Mcal_RegInitType %s[] = {" % cname]
    for i, (a, v) in enumerate(rows):
        out.append("    { 0x%08Xu, 0x%08Xu },   /* %2d */" % (a, v, i))
    out.append("};")
    return "\n".join(out) + "\n"


# ---------------------------------------------------------------- TIM1 / Pwm
ARR = 4200
CCMR_PWM1_PRE = (6 << 4) | (1 << 3)            # OCxM = 110, OCxPE
CCMR1 = CCMR_PWM1_PRE | (CCMR_PWM1_PRE << 8)
CCMR2 = CCMR_PWM1_PRE | (CCMR_PWM1_PRE << 8)
CCER_ALL = 0x0555 | (1 << 12)                   # CC1..3 E/NE, CC4E
CR2_MMS_UPDATE = 2 << 4
BDTR_OFF = (1 << 11) | (1 << 10) | 84           # OSSR, OSSI, DTG 84
BDTR_RUN = (1 << 15) | BDTR_OFF
BDTR_LOW = (1 << 15) | (1 << 11) | (1 << 10) | 60
CR1_RUN = (1 << 7) | (1 << 5) | 1               # ARPE, CMS = 01, CEN


def r(base, off, val):
    return (base + off, val)


PWM_INIT = [
    r(TIM1, 0x00, 0x00000000), r(TIM1, 0x04, CR2_MMS_UPDATE), r(TIM1, 0x08, 0), r(TIM1, 0x0C, 0),
    r(TIM1, 0x18, CCMR1), r(TIM1, 0x1C, CCMR2), r(TIM1, 0x20, 0), r(TIM1, 0x28, 0),
    r(TIM1, 0x2C, ARR), r(TIM1, 0x30, 1), r(TIM1, 0x34, ARR // 2), r(TIM1, 0x38, ARR // 2),
    r(TIM1, 0x3C, ARR // 2), r(TIM1, 0x40, ARR - 1), r(TIM1, 0x44, BDTR_OFF),
]
PWM_START = [r(TIM1, 0x14, 1), r(TIM1, 0x00, CR1_RUN)]
PWM_MODES = [
    ("Off", [r(TIM1, 0x44, BDTR_OFF), r(TIM1, 0x20, 0)]),
    ("Align", [r(TIM1, 0x04, CR2_MMS_UPDATE), r(TIM1, 0x20, CCER_ALL), r(TIM1, 0x30, 1),
               r(TIM1, 0x40, ARR - 1), r(TIM1, 0x44, BDTR_RUN)]),
    ("Run", [r(TIM1, 0x04, CR2_MMS_UPDATE), r(TIM1, 0x20, CCER_ALL), r(TIM1, 0x30, 1),
             r(TIM1, 0x40, ARR - 1), r(TIM1, 0x44, BDTR_RUN)]),
    ("LowRipple", [r(TIM1, 0x04, CR2_MMS_UPDATE), r(TIM1, 0x20, CCER_ALL), r(TIM1, 0x30, 0),
                   r(TIM1, 0x40, ARR - 1), r(TIM1, 0x44, BDTR_LOW)]),
    ("Brake", [r(TIM1, 0x34, 0), r(TIM1, 0x38, 0), r(TIM1, 0x3C, 0), r(TIM1, 0x20, CCER_ALL),
               r(TIM1, 0x30, 1), r(TIM1, 0x44, BDTR_RUN)]),
]


def pwm_cfg_h():
    s = hdr("Pwm_Cfg.h", "PwmConfigurator 4.1.2 (MCAL STM32F4 R4.2.2)", "PWM driver configuration")
    s += """#ifndef PWM_CFG_H
#define PWM_CFG_H

#include "Mcal_Types.h"

#define PWM_HW_UNIT_0_BASE       0x%08Xu
#define PWM_CHANNEL_COUNT        3u

typedef enum {
""" % TIM1
    for i, (n, _) in enumerate(PWM_MODES):
        s += "    PwmConf_PwmMode_%s = %d,\n" % (n, i)
    s += """    PwmConf_PwmMode_Count
} Pwm_ModeType;

typedef struct {
    Mcal_RegSeqType init;
    Mcal_RegSeqType start;
    Mcal_RegSeqType mode[PwmConf_PwmMode_Count];
} Pwm_ConfigType;

extern const Pwm_ConfigType Pwm_Config;

#endif
"""
    return s


def pwm_cfg_c():
    s = hdr("Pwm_Cfg.c", "PwmConfigurator 4.1.2 (MCAL STM32F4 R4.2.2)", "PWM driver configuration")
    s += '#include "Pwm_Cfg.h"\n\n'
    s += table("Pwm_InitRegs", PWM_INIT) + "\n"
    s += table("Pwm_StartRegs", PWM_START) + "\n"
    for n, rows in PWM_MODES:
        s += table("Pwm_Mode%sRegs" % n, rows) + "\n"
    s += "const Pwm_ConfigType Pwm_Config = {\n"
    s += "    MCAL_SEQ(Pwm_InitRegs),\n    MCAL_SEQ(Pwm_StartRegs),\n    {\n"
    for n, _ in PWM_MODES:
        s += "        MCAL_SEQ(Pwm_Mode%sRegs),\n" % n
    s += "    },\n};\n"
    return s


PWM_C = hdr("Pwm.c", "MCAL STM32F4 R4.2.2, static code", "PWM driver") + """#include "Pwm.h"
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
"""

MCAL_TYPES_H = hdr("Mcal_Types.h", "MCAL STM32F4 R4.2.2, static code", "Common types of the generated configuration") + """#ifndef MCAL_TYPES_H
#define MCAL_TYPES_H

#include "Std_Types.h"

/* One register write of a configuration sequence, applied in table order. */
typedef struct {
    uint32 addr;
    uint32 value;
} Mcal_RegInitType;

typedef struct {
    const Mcal_RegInitType *regs;
    uint16 count;
} Mcal_RegSeqType;

#define MCAL_SEQ(t)   { (t), (uint16)(sizeof(t) / sizeof((t)[0])) }

#endif
"""

# ---------------------------------------------------------------- ADC
ADC_INIT = [
    r(ADC_COMMON, 0x04, (1 << 16) | 0x05),        # ADCPRE /4, MULTI injected simultaneous
    r(ADC1, 0x04, (1 << 8) | (1 << 7)),           # SCAN, JEOCIE
    r(ADC1, 0x10, 0x00000049),                    # SMPR2: ch0..2 15 cycles
    r(ADC1, 0x38, (1 << 20) | (2 << 15) | (0 << 10)),
    r(ADC1, 0x08, (1 << 20) | (1 << 16) | 1),     # JEXTEN rising, JEXTSEL 0001, ADON
    r(ADC2, 0x04, 1 << 8),
    r(ADC2, 0x10, 0x00000049),
    r(ADC2, 0x38, 1 << 15),
    r(ADC2, 0x08, 1),
    r(ADC3, 0x04, 1 << 8),                        # temperatures, polled by Monitor
    r(ADC3, 0x0C, 0x00000000),
    r(ADC3, 0x10, 0x00000FFF),                    # SMPR2: ch0..3 480 cycles
    r(ADC3, 0x2C, 3 << 20),                       # SQR1: L = 3, four conversions
    r(ADC3, 0x34, (13 << 15) | (12 << 10) | (11 << 5) | 10),
    r(ADC3, 0x08, (1 << 10) | 1),                 # EOCS, ADON, software start
]


def adc_cfg_c():
    s = hdr("Adc_Cfg.c", "AdcConfigurator 4.1.2 (MCAL STM32F4 R4.2.2)", "ADC driver configuration")
    s += '#include "Adc_Cfg.h"\n\n' + table("Adc_InitRegs", ADC_INIT) + "\n"
    s += """const Adc_ConfigType Adc_Config = {
    MCAL_SEQ(Adc_InitRegs),
    {   /* group, hw unit, channels, trigger */
        { AdcConf_AdcGroup_PhaseCurrents, 0u, 2u, ADC_TRIGG_SRC_HW },
        { AdcConf_AdcGroup_PhaseB,        1u, 1u, ADC_TRIGG_SRC_HW },
        { AdcConf_AdcGroup_Temperatures,  2u, 4u, ADC_TRIGG_SRC_SW },
    },
};
"""
    return s


ADC_CFG_H = hdr("Adc_Cfg.h", "AdcConfigurator 4.1.2 (MCAL STM32F4 R4.2.2)", "ADC driver configuration") + """#ifndef ADC_CFG_H
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
"""

# ---------------------------------------------------------------- Port
PINS = [  # port, pin, mode (0 in, 1 out, 2 af, 3 analog), af, speed, pull, name
    ("A", 0, 3, 0, 0, 0, "ADC123_IN0  phase current A"),
    ("A", 1, 3, 0, 0, 0, "ADC123_IN1  phase current B"),
    ("A", 2, 3, 0, 0, 0, "ADC123_IN2  DC-link voltage"),
    ("A", 3, 3, 0, 0, 0, "ADC123_IN3  spare"),
    ("A", 8, 2, 1, 3, 0, "TIM1_CH1    phase A high side"),
    ("A", 9, 2, 1, 3, 0, "TIM1_CH2    phase B high side"),
    ("A", 10, 2, 1, 3, 0, "TIM1_CH3    phase C high side"),
    ("A", 11, 2, 9, 2, 0, "CAN1_RX"),
    ("A", 12, 2, 9, 2, 0, "CAN1_TX"),
    ("A", 13, 2, 0, 2, 1, "SWDIO"),
    ("A", 14, 2, 0, 2, 2, "SWCLK"),
    ("B", 6, 1, 0, 1, 0, "DIO         gate driver enable"),
    ("B", 7, 0, 0, 0, 1, "DIO         gate driver fault (low active)"),
    ("B", 12, 2, 1, 3, 1, "TIM1_BKIN   overcurrent comparator"),
    ("B", 13, 2, 1, 3, 0, "TIM1_CH1N   phase A low side"),
    ("B", 14, 2, 1, 3, 0, "TIM1_CH2N   phase B low side"),
    ("B", 15, 2, 1, 3, 0, "TIM1_CH3N   phase C low side"),
    ("C", 0, 3, 0, 0, 0, "ADC123_IN10 board temperature"),
    ("C", 1, 3, 0, 0, 0, "ADC123_IN11 power stage temperature"),
    ("C", 2, 3, 0, 0, 0, "ADC123_IN12 coolant temperature"),
    ("C", 3, 3, 0, 0, 0, "ADC123_IN13 motor winding temperature"),
    ("C", 13, 1, 0, 0, 0, "DIO         status LED"),
    ("C", 14, 0, 0, 0, 2, "DIO         hardware variant bit 0"),
    ("C", 15, 0, 0, 0, 2, "DIO         hardware variant bit 1"),
]


def port_regs():
    rows = []
    for p, base in GPIO.items():
        moder = otyper = ospeedr = pupdr = afrl = afrh = 0
        if p == "A":
            moder |= (2 << 26) | (2 << 28)
        for (pp, n, mode, af, spd, pull, _) in PINS:
            if pp != p:
                continue
            moder = (moder & ~(3 << 2 * n)) | (mode << 2 * n)
            ospeedr |= spd << 2 * n
            pupdr |= pull << 2 * n
            if n < 8:
                afrl |= af << 4 * n
            else:
                afrh |= af << 4 * (n - 8)
        rows += [r(base, 0x24, afrh), r(base, 0x20, afrl), r(base, 0x0C, pupdr),
                 r(base, 0x08, ospeedr), r(base, 0x04, otyper), r(base, 0x00, moder)]
    return rows


def port_cfg_c():
    s = hdr("Port_Cfg.c", "PortConfigurator 4.1.2 (MCAL STM32F4 R4.2.2)", "Port driver configuration")
    s += '#include "Port_Cfg.h"\n\n/* Pin assignment\n'
    for (p, n, mode, af, spd, pull, name) in PINS:
        s += " *   P%s%-3d %-6s AF%-2d %s\n" % (p, n, ["in", "out", "af", "analog"][mode], af, name)
    s += " */\n\n" + table("Port_InitRegs", port_regs()) + "\n"
    s += "const Port_ConfigType Port_Config = { MCAL_SEQ(Port_InitRegs) };\n"
    return s


# ---------------------------------------------------------------- Gpt
GPT_INIT = [r(TIM2, 0x00, 0), r(TIM2, 0x0C, 0), r(TIM2, 0x28, 83), r(TIM2, 0x2C, 0xFFFFFFFF),
            r(TIM2, 0x14, 1), r(TIM2, 0x00, 1)]


def gpt_cfg_c():
    s = hdr("Gpt_Cfg.c", "GptConfigurator 4.1.2 (MCAL STM32F4 R4.2.2)", "GPT driver configuration")
    s += ('#include "Gpt_Cfg.h"\n\n/* GptChannel_FreeRun: 32-bit free-running time base for the speed\n'
          ' * observer and diagnostics. Polled, no notification. */\n\n')
    s += table("Gpt_InitRegs", GPT_INIT) + "\n"
    s += "const Gpt_ConfigType Gpt_Config = { MCAL_SEQ(Gpt_InitRegs), 1000000u };\n"
    return s


# ---------------------------------------------------------------- calibration and speed control
CAL = [
    ("SpdMin_rpm", "int32", 600, "lowest commanded speed in operation"),
    ("SpdMax_rpm", "int32", 5200, "highest commanded speed"),
    ("SpdStart_rpm", "int32", 450, "open-loop ramp target, observer hand-over"),
    ("SpdRampUp_rpm_per_s", "int32", 1500, "setpoint ramp, accelerating"),
    ("SpdRampDown_rpm_per_s", "int32", 2500, "setpoint ramp, decelerating"),
    ("SpdPi_Kp_q12", "int32", 1843, "speed PI proportional gain, Q12"),
    ("SpdPi_Ki_q12", "int32", 96, "speed PI integral gain per ms, Q12"),
    ("SpdPi_IqMax_mA", "int32", 24000, "q-axis current limit"),
    ("SpdStall_ms", "int32", 1500, "no speed above SpdMin within this time: stall"),
    ("AlignTime_ms", "int32", 300, "rotor alignment before the open-loop ramp"),
    ("AlignCurrent_mA", "int32", 9000, "d-axis current during alignment"),
    ("OpenLoopAccel_rpm_per_s", "int32", 900, "open-loop ramp rate"),
    ("ObsGain_q12", "int32", 2457, "flux observer gain, Q12"),
    ("ObsLockTol_rpm", "int32", 60, "observer/ramp mismatch accepted at hand-over"),
    ("PwmModeLowEnter_rpm", "int32", 900, "PwmConf_PwmMode_LowRipple below this speed"),
    ("PwmModeLowExit_rpm", "int32", 1000, "back to PwmConf_PwmMode_Run above this speed"),
    ("FieldWeakStart_rpm", "int32", 4300, "field weakening starts"),
    ("FieldWeakIdMin_mA", "int32", -11000, "most negative d-axis current"),
    ("BrakeTime_ms", "int32", 400, "active braking after a stop request"),
    ("VdcMin_mV", "int32", 8500, "undervoltage cut-off"),
    ("VdcMax_mV", "int32", 17500, "overvoltage cut-off"),
    ("VdcDerateStart_mV", "int32", 9500, "power derating below this voltage"),
    ("TempStageDerate_dC", "int32", 1150, "power stage derating start, 0.1 degC"),
    ("TempStageTrip_dC", "int32", 1300, "power stage trip, 0.1 degC"),
    ("TempWindDerate_dC", "int32", 1500, "winding derating start, 0.1 degC"),
    ("TempWindTrip_dC", "int32", 1700, "winding trip, 0.1 degC"),
    ("TempCoolantMax_dC", "int32", 1250, "coolant over-temperature DTC, 0.1 degC"),
    ("DtcDebounceUp", "int32", 8, "debounce counter step on a failed check"),
    ("DtcDebounceDown", "int32", 1, "debounce counter step on a passed check"),
    ("DtcDebounceLimit", "int32", 127, "debounce counter limit"),
    ("CanTimeout_ms", "int32", 500, "setpoint message timeout"),
    ("CanFallback_rpm", "int32", 3000, "speed without a valid setpoint"),
    ("NvmFreezeFrameMax", "int32", 8, "freeze frames kept per DTC"),
    ("AfterRunTime_s", "int32", 300, "after-run time after ignition off"),
    ("AfterRun_rpm", "int32", 1800, "after-run speed"),
]


def cal_h():
    s = "/* Cal_Data.h - calibration parameters (flash, page CAL) */\n#ifndef CAL_DATA_H\n#define CAL_DATA_H\n\n"
    s += "#include <stdint.h>\n\ntypedef int32_t int32;\n\ntypedef struct {\n"
    for n, t, _, c in CAL:
        s += "    %s %s;%s/* %s */\n" % (t, n, " " * max(1, 28 - len(n)), c)
    s += "} Cal_DataType;\n\nextern const Cal_DataType Cal;\n\n#endif\n"
    return s


def cal_c():
    s = ("/* Cal_Data.c - calibration data set ECP300_CAL_3_2_0_A, 2026-06-02 */\n"
         '#include "Cal_Data.h"\n\n__attribute__((section(".cal")))\nconst Cal_DataType Cal = {\n')
    for n, _, v, _ in CAL:
        s += "    .%s = %d,\n" % (n.ljust(26), v)
    s += "};\n"
    return s


SPEED_C = """/* speed_ctrl.c - SpeedCtrl job: speed setpoint, start-up, speed PI, PWM mode
 *
 * speed_loop_step() is the SpeedCtrl job body (tasks.c), every 1 ms.
 */
#include "app.h"
#include "foc.h"
#include "Cal_Data.h"
#include "Pwm.h"

typedef enum { SPD_STOP, SPD_ALIGN, SPD_OPENLOOP, SPD_RUN, SPD_BRAKE } spd_state_t;

static spd_state_t s_state = SPD_STOP;
static int32 s_ref_rpm;          /* ramped setpoint */
static int32 s_ol_rpm;           /* open-loop ramp speed */
static int32 s_t_ms;             /* time in the current state */
static int32 s_iq_int;           /* PI integrator, Q12 mA */

static int32 ramp(int32 x, int32 target, int32 up, int32 down)
{
    int32 su = up / 1000, sd = down / 1000;
    if (x < target)
        return (target - x < su) ? target : x + su;
    if (x > target)
        return (x - target < sd) ? target : x - sd;
    return x;
}

static Pwm_ModeType run_pwm_mode(int32 rpm)
{
    static Pwm_ModeType mode = PwmConf_PwmMode_Run;
    if (rpm < Cal.PwmModeLowEnter_rpm)
        mode = PwmConf_PwmMode_LowRipple;
    else if (rpm > Cal.PwmModeLowExit_rpm)
        mode = PwmConf_PwmMode_Run;
    return mode;
}

void speed_loop_step(void)
{
    const int32 cmd = app_speed_command_rpm();          /* CAN setpoint or fallback, 0 = stop */
    const int32 est = foc_observer_speed_rpm();
    s_t_ms++;

    switch (s_state) {
    case SPD_STOP:
        (void)Pwm_SetMode(PwmConf_PwmMode_Off);
        if (cmd >= Cal.SpdMin_rpm && !app_inhibit()) {
            s_state = SPD_ALIGN;
            s_t_ms = 0;
            foc_set_current_ref(Cal.AlignCurrent_mA, 0);
        }
        break;

    case SPD_ALIGN:
        (void)Pwm_SetMode(PwmConf_PwmMode_Align);
        if (s_t_ms >= Cal.AlignTime_ms) {
            s_state = SPD_OPENLOOP;
            s_t_ms = 0;
            s_ol_rpm = 0;
        }
        break;

    case SPD_OPENLOOP:
        (void)Pwm_SetMode(run_pwm_mode(s_ol_rpm));
        s_ol_rpm = ramp(s_ol_rpm, Cal.SpdStart_rpm, Cal.OpenLoopAccel_rpm_per_s, Cal.OpenLoopAccel_rpm_per_s);
        foc_set_open_loop(s_ol_rpm, Cal.AlignCurrent_mA);
        if (s_ol_rpm == Cal.SpdStart_rpm) {
            int32 d = est - s_ol_rpm;
            if (d < 0)
                d = -d;
            if (d <= Cal.ObsLockTol_rpm) {
                s_state = SPD_RUN;
                s_t_ms = 0;
                s_ref_rpm = s_ol_rpm;
                s_iq_int = 0;
            } else if (s_t_ms > Cal.SpdStall_ms) {
                app_report_stall();
                s_state = SPD_STOP;
            }
        }
        break;

    case SPD_RUN: {
        if (cmd < Cal.SpdMin_rpm || app_inhibit()) {
            s_state = SPD_BRAKE;
            s_t_ms = 0;
            break;
        }
        int32 tgt = cmd > Cal.SpdMax_rpm ? Cal.SpdMax_rpm : cmd;
        s_ref_rpm = ramp(s_ref_rpm, tgt, Cal.SpdRampUp_rpm_per_s, Cal.SpdRampDown_rpm_per_s);
        int32 err = s_ref_rpm - est;
        s_iq_int += err * Cal.SpdPi_Ki_q12;
        int32 lim = Cal.SpdPi_IqMax_mA << 12;
        if (s_iq_int > lim) s_iq_int = lim;
        if (s_iq_int < -lim) s_iq_int = -lim;
        int32 iq = (err * Cal.SpdPi_Kp_q12 + s_iq_int) >> 12;
        if (iq > Cal.SpdPi_IqMax_mA) iq = Cal.SpdPi_IqMax_mA;
        if (iq < 0) iq = 0;
        int32 id = 0;
        if (est > Cal.FieldWeakStart_rpm) {
            id = (Cal.FieldWeakIdMin_mA * (est - Cal.FieldWeakStart_rpm)) / (Cal.SpdMax_rpm - Cal.FieldWeakStart_rpm);
            if (id < Cal.FieldWeakIdMin_mA) id = Cal.FieldWeakIdMin_mA;
        }
        foc_set_current_ref(id, iq);
        (void)Pwm_SetMode(run_pwm_mode(est));
        if (est < Cal.SpdMin_rpm / 2 && s_t_ms > Cal.SpdStall_ms)
            app_report_stall();
        break;
    }

    case SPD_BRAKE:
        (void)Pwm_SetMode(PwmConf_PwmMode_Brake);
        if (s_t_ms >= Cal.BrakeTime_ms)
            s_state = SPD_STOP;
        break;
    }
}
"""


# ---------------------------------------------------------------- Dem and NvM (volume, no timing)
DTCS = [
    ("P0A01", "MotorPositionSensorPerf", "SpeedCtrl"), ("P0A0F", "MotorStartFailure", "SpeedCtrl"),
    ("P0A1B", "MotorControlModulePerf", "Monitor"), ("P0A2A", "WindingTempSensorRange", "Monitor"),
    ("P0A2B", "WindingTempHigh", "Monitor"), ("P0A3C", "PowerStageTempHigh", "Monitor"),
    ("P0A3D", "PowerStageTempSensorRange", "Monitor"), ("P0A44", "MotorOverspeed", "SpeedCtrl"),
    ("P0A45", "MotorStall", "SpeedCtrl"), ("P0A78", "InverterPerf", "Monitor"),
    ("P0A7A", "GateDriverFault", "Monitor"), ("P0A90", "PhaseAOpen", "Monitor"),
    ("P0A91", "PhaseBOpen", "Monitor"), ("P0A92", "PhaseCOpen", "Monitor"),
    ("P0A93", "PhaseCurrentSensorA", "Monitor"), ("P0A94", "PhaseCurrentSensorB", "Monitor"),
    ("P0C29", "DcLinkVoltageLow", "Monitor"), ("P0C2A", "DcLinkVoltageHigh", "Monitor"),
    ("P0C2B", "DcLinkVoltageSensor", "Monitor"), ("P2600", "CoolantPumpControlOpen", "Monitor"),
    ("P2601", "CoolantPumpControlRange", "Monitor"), ("P2602", "CoolantPumpControlLow", "Monitor"),
    ("P2603", "CoolantPumpControlHigh", "Monitor"), ("P261A", "CoolantPumpBPerf", "Monitor"),
    ("P0217", "CoolantOverTemp", "Monitor"), ("P0562", "SupplyVoltageLow", "Monitor"),
    ("P0563", "SupplyVoltageHigh", "Monitor"), ("P0601", "RomChecksum", "Supervisor"),
    ("P0604", "RamError", "Supervisor"), ("P0606", "ProcessorFault", "Supervisor"),
    ("P0607", "ControlModulePerf", "Supervisor"), ("P062F", "EepromError", "NvM"),
    ("P0630", "VinNotProgrammed", "NvM"), ("P0A0A", "HvilCircuit", "Monitor"),
    ("U0001", "CanBusHigh", "CanComm"), ("U0073", "CanBusOff", "CanComm"),
    ("U0100", "LostCommEcm", "CanComm"), ("U0101", "LostCommTcm", "CanComm"),
    ("U0140", "LostCommBcm", "CanComm"), ("U0155", "LostCommCluster", "CanComm"),
    ("U0164", "LostCommHvac", "CanComm"), ("U0293", "LostCommHybridCtrl", "CanComm"),
    ("U0401", "InvalidDataEcm", "CanComm"), ("U0415", "InvalidDataAbs", "CanComm"),
    ("U0422", "InvalidDataBcm", "CanComm"), ("U1000", "SetpointTimeout", "CanComm"),
    ("U3000", "ControlModuleSwFault", "Supervisor"), ("U3001", "ControlModuleShutdown", "Supervisor"),
    ("B1000", "EcuInternalFault", "Supervisor"), ("B1001", "TmonOverrun", "Supervisor"),
    ("B1002", "WatchdogReset", "Supervisor"), ("B1003", "StackOverflow", "Supervisor"),
    ("B1004", "AliveSupervision", "Supervisor"), ("B1005", "ClockMonitor", "Supervisor"),
]
NVM_BLOCKS = [
    ("NvMConfig", 4), ("EcuIdentification", 64), ("VinData", 20), ("HwVariant", 4),
    ("CalibrationSelect", 8), ("OperatingHours", 8), ("StartCounter", 4), ("ResetCounters", 32),
    ("ResetFreezeFrame", 96), ("TmonStatistics", 80), ("SpeedHistogram", 128),
    ("TempHistogramStage", 128), ("TempHistogramWinding", 128), ("TempHistogramCoolant", 128),
    ("VdcHistogram", 64), ("DeratingCounters", 32), ("StallCounters", 16), ("BrakeCounters", 16),
    ("CanStatistics", 48), ("ObserverLearnValues", 24), ("CurrentOffsetLearn", 16),
    ("AfterRunLog", 64), ("ProgrammingInfo", 48), ("FingerprintApp", 32), ("FingerprintCal", 32),
]


def dem_cfg_c():
    s = hdr("Dem_Cfg.c", "DemConfigurator 4.2.0 (BSW R4.2.2)", "Diagnostic event manager configuration")
    s += '#include "Dem_Cfg.h"\n\n/* event, DTC, debounce class, freeze frame class, operation cycle, reporting task */\n'
    s += "const Dem_EventParameterType Dem_EventParameter[DEM_NUMBER_OF_EVENTS] = {\n"
    for i, (dtc, name, task) in enumerate(DTCS):
        code = int(dtc[1:], 16) | ({"P": 0, "C": 1, "B": 2, "U": 3}[dtc[0]] << 14)
        deb = "DEM_DEBOUNCE_COUNTER" if task in ("Monitor", "CanComm") else "DEM_DEBOUNCE_MONITOR_INTERNAL"
        ff = "DemFreezeFrameClass_Motor" if task in ("SpeedCtrl", "Monitor") else "DemFreezeFrameClass_Ecu"
        s += "    { DemConf_DemEventParameter_%-26s 0x%04X00u, %-30s %-26s DEM_OPCYC_POWER, /* %s */ },\n" % (
            name + ",", code, deb + ",", ff + ",", task)
    s += "};\n\n"
    s += """const Dem_FreezeFrameClassType DemFreezeFrameClass_Motor = {
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
"""
    return s


def nvm_cfg_c():
    s = hdr("NvM_Cfg.c", "NvMConfigurator 4.2.0 (BSW R4.2.2)", "NVRAM manager configuration")
    s += '#include "NvM_Cfg.h"\n#include "Fee_Cfg.h"\n\n'
    s += "/* block id, length, FEE block, CRC, write once, immediate, priority */\n"
    s += "const NvM_BlockDescriptorType NvM_BlockDescriptorTable[NVM_TOTAL_NUMBER_OF_NVRAM_BLOCKS] = {\n"
    off = 0
    for i, (name, ln) in enumerate(NVM_BLOCKS, start=1):
        wo = "TRUE " if name in ("VinData", "EcuIdentification", "HwVariant") else "FALSE"
        imm = "TRUE " if name in ("ResetFreezeFrame", "ResetCounters") else "FALSE"
        s += "    { %2du, %4du, FeeConf_FeeBlock_%-22s NVM_CRC16, %s, %s, %3du },   /* %s */\n" % (
            i, ln, name + ",", wo, imm, 1 if imm.strip() == "TRUE" else 127, name)
        off += ln
    s += "};\n\n/* Emulated EEPROM: two 16 KB sectors (sector 1 and 2), %d bytes of block data. */\n" % off
    s += "const Fee_SectorType Fee_Sectors[2] = {\n    { 0x08004000u, 0x4000u },\n    { 0x08008000u, 0x4000u },\n};\n"
    return s


def main():
    src = os.path.join(sys.argv[1], "environment", "data", "src")
    files = {
        "mcal/Mcal_Types.h": MCAL_TYPES_H,
        "mcal/Pwm.c": PWM_C,
        "mcal/Pwm_Cfg.h": pwm_cfg_h(),
        "mcal/Pwm_Cfg.c": pwm_cfg_c(),
        "mcal/Adc_Cfg.h": ADC_CFG_H,
        "mcal/Adc_Cfg.c": adc_cfg_c(),
        "mcal/Port_Cfg.c": port_cfg_c(),
        "mcal/Gpt_Cfg.c": gpt_cfg_c(),
        "app/Cal_Data.h": cal_h(),
        "app/Cal_Data.c": cal_c(),
        "app/speed_ctrl.c": SPEED_C,
        "bsw/Dem_Cfg.c": dem_cfg_c(),
        "bsw/NvM_Cfg.c": nvm_cfg_c(),
    }
    for rel, text in files.items():
        p = os.path.join(src, *rel.split("/"))
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, "w", newline="\n", encoding="utf-8") as f:
            f.write(text)
        print("%-22s %5d lines" % (rel, text.count("\n")))


if __name__ == "__main__":
    main()

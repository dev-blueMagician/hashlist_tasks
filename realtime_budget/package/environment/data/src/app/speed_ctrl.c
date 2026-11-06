/* speed_ctrl.c - SpeedCtrl job: speed setpoint, start-up, speed PI, PWM mode
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

/* harness.c - withheld grader for the ECP-300 timing configuration task.
 *
 * Built by the platform as
 *   gcc -O2 -std=c11 -I/tests -o /tmp/prog /tests/harness.c /app/solution.c -lm
 * It reads the configuration that solution.c defines (os_cfg.h), recomputes
 * the TAG-01 analysis with the true worst-case loads of software 3.2.0, and
 * prints one metric=value line per scored quantity, then some info lines.
 *
 * True loads (us): task WCETs are the largest net execution times in the
 * three reference traces; ISR WCETs are the largest handler times there.
 * CAN1_RX0 is not bracketed by TMON in 3.2.0 (can_if_glue.c), its filter
 * accepts 0x700-0x7FF, and VN-07 allows back-to-back 8-byte frames at
 * 500 kbit/s: one frame per 111 bit times = 222 us. ADC runs every 25 us
 * below 900 rpm: speed_ctrl.c selects PwmConf_PwmMode_LowRipple there, whose
 * table in mcal/Pwm_Cfg.c writes 0 to 0x40010030 (TIM1_RCR); in center-aligned mode
 * that gives an update event (TRGO) at each overflow and underflow of the
 * 20 kHz carrier (RM0090 17.3.3). No trace runs that slowly; the SRS speed
 * range includes it. LSI 17-47 kHz (STM32F405 datasheet, LSI oscillator
 * characteristics).
 */
#define _POSIX_C_SOURCE 200809L
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>

#include "os_cfg.h"

#define N_ISR 3

static const char *const LABEL[TASK_COUNT] = {
    "speedctrl", "cancomm", "monitor", "supervisor", "nvm"
};
/* SRS-ECP300 SR-TIM-01: periods and deadlines are fixed; solution values are ignored */
static const double PERIOD_US[TASK_COUNT]   = { 1000.0, 5000.0, 10000.0, 20000.0, 100000.0 };
static const double DEADLINE_US[TASK_COUNT] = { 1000.0, 5000.0, 10000.0, 20000.0, 100000.0 };
static const double WCET_US[TASK_COUNT]     = { 150.0, 380.0, 780.0, 240.0, 3900.0 };

/* ADC_IRQHandler (FOC), CAN1_RX0_IRQHandler, SysTick_Handler */
static const double ISR_T_US[N_ISR]   = { 25.0, 222.0, 1000.0 };
static const double ISR_C_US[N_ISR]   = { 9.0, 52.0, 3.0 };
static const int    ISR_CHARGED[N_ISR] = { 0, 1, 1 };

static const double LSI_MIN_HZ = 17000.0;
static const double LSI_MAX_HZ = 47000.0;
static const int MAX_PRIORITY = 7;      /* configMAX_PRIORITIES - 1 */

/* Largest monitored time of a fault-free job, TAG-01 section 3. */
static double monitored_us(double c)
{
    double w = c;
    for (int it = 0; it < 100000; it++) {
        double all = c, charged = c;
        for (int k = 0; k < N_ISR; k++) {
            double n = ceil(w / ISR_T_US[k]);
            all += n * ISR_C_US[k];
            if (ISR_CHARGED[k])
                charged += n * ISR_C_US[k];
        }
        if (all == w)
            return charged;
        w = all;
    }
    return INFINITY;
}

/* Response time with every job at its budget, TAG-01 section 4.
 * Returns INFINITY when it exceeds the limit. */
static double response_us(int i, const double *budget, const int *prio, double limit)
{
    double r = budget[i];
    for (int it = 0; it < 100000; it++) {
        double next = budget[i];
        for (int j = 0; j < TASK_COUNT; j++)
            if (j != i && prio[j] >= prio[i])
                next += ceil(r / PERIOD_US[j]) * budget[j];
        for (int k = 0; k < N_ISR; k++)
            if (!ISR_CHARGED[k])
                next += ceil(r / ISR_T_US[k]) * ISR_C_US[k];
        if (next == r)
            return r;
        if (next > limit)
            return INFINITY;
        r = next;
    }
    return INFINITY;
}

/* The answer is a configuration file. Reject code that could run before or
 * instead of this harness: main, attributes, asm, pragmas. Comments and
 * string literals are ignored. Returns a short reason, or NULL. */
static const char *tamper_reason(const char *path)
{
    FILE *f = fopen(path, "rb");
    if (!f)
        return NULL;            /* nothing to scan; the build already used it */
    static char buf[1 << 20];
    size_t n = fread(buf, 1, sizeof buf - 1, f);
    fclose(f);
    buf[n] = '\0';
    /* blank out comments and literals */
    for (size_t i = 0; i < n; i++) {
        if (buf[i] == '/' && buf[i + 1] == '*') {
            size_t j = i;
            while (j < n && !(buf[j] == '*' && buf[j + 1] == '/'))
                buf[j++] = ' ';
            if (j < n) { buf[j] = ' '; buf[j + 1] = ' '; }
            i = j + 1;
        } else if (buf[i] == '/' && buf[i + 1] == '/') {
            while (i < n && buf[i] != '\n')
                buf[i++] = ' ';
        } else if (buf[i] == '"' || buf[i] == '\'') {
            char q = buf[i];
            size_t j = i + 1;
            while (j < n && buf[j] != q) {
                if (buf[j] == '\\' && j + 1 < n)
                    buf[j++] = ' ';
                buf[j++] = ' ';
            }
            i = j;
        }
    }
    static const char *const banned[] = {
        "main", "__attribute__", "__attribute", "asm", "__asm", "__asm__", "_Pragma", NULL
    };
    for (size_t i = 0; i < n; ) {
        if (isalpha((unsigned char)buf[i]) || buf[i] == '_') {
            size_t j = i;
            while (j < n && (isalnum((unsigned char)buf[j]) || buf[j] == '_'))
                j++;
            for (int b = 0; banned[b]; b++)
                if (strlen(banned[b]) == j - i && memcmp(buf + i, banned[b], j - i) == 0)
                    return banned[b];
            i = j;
        } else if (buf[i] == '#') {
            size_t j = i + 1;
            while (j < n && (buf[j] == ' ' || buf[j] == '\t'))
                j++;
            if (strncmp(buf + j, "pragma", 6) == 0)
                return "#pragma";
            i = j;
        } else {
            i++;
        }
    }
    return NULL;
}

static void print_failing(const char *why)
{
    printf("config_ok=0\n");
    for (int i = 0; i < TASK_COUNT; i++)
        printf("budget_%s_ratio=0\n", LABEL[i]);
    printf("deadlines_met=0\n");
    printf("wdg_margin_us=-1000000000\n");
    printf("wdg_max_timeout_ms=1000000000\n");
    printf("info_reason=%s\n", why);
}

int main(void)
{
    const char *why = tamper_reason("/app/solution.c");
    if (why) {
        print_failing(why);
        return 0;
    }

    double budget[TASK_COUNT];
    int prio[TASK_COUNT];
    for (int i = 0; i < TASK_COUNT; i++) {
        budget[i] = (double)os_task_cfg[i].budget_us;
        prio[i] = (int)os_task_cfg[i].priority;
        if (prio[i] < 1 || prio[i] > MAX_PRIORITY) {
            print_failing("priority out of range");
            return 0;
        }
    }
    unsigned pr = os_iwdg_cfg.prescaler, rl = os_iwdg_cfg.reload;
    if (pr > 7u || rl > 4095u) {
        print_failing("IWDG register value out of range");
        return 0;
    }
    printf("config_ok=1\n");

    double m[TASK_COUNT];
    for (int i = 0; i < TASK_COUNT; i++) {
        m[i] = monitored_us(WCET_US[i]);
        printf("budget_%s_ratio=%.4f\n", LABEL[i], budget[i] > 0.0 ? budget[i] / m[i] : 0.0);
    }

    /* every budget must be positive for the analysis to mean anything */
    int all_monitored = 1;
    for (int i = 0; i < TASK_COUNT; i++)
        if (budget[i] <= 0.0)
            all_monitored = 0;

    double r[TASK_COUNT];
    int met = 0;
    for (int i = 0; i < TASK_COUNT; i++) {
        r[i] = all_monitored ? response_us(i, budget, prio, 4.0 * PERIOD_US[TASK_NVM]) : INFINITY;
        if (r[i] <= DEADLINE_US[i])
            met++;
    }
    printf("deadlines_met=%d\n", met);

    double ticks = (double)(4u << (pr > 6u ? 6u : pr)) * (double)(rl + 1u);
    double t_fast_us = ticks / LSI_MAX_HZ * 1e6;
    double t_slow_ms = ticks / LSI_MIN_HZ * 1e3;
    double kick_us = PERIOD_US[TASK_SUPERVISOR] + r[TASK_SUPERVISOR];
    double margin = isfinite(kick_us) ? t_fast_us - kick_us : -1e9;
    printf("wdg_margin_us=%.1f\n", margin);
    printf("wdg_max_timeout_ms=%.2f\n", t_slow_ms);

    for (int i = 0; i < TASK_COUNT; i++)
        printf("info_m_%s_us=%.1f\n", LABEL[i], m[i]);
    for (int i = 0; i < TASK_COUNT; i++) {
        if (isfinite(r[i]))
            printf("info_r_%s_us=%.1f\n", LABEL[i], r[i]);
        else
            printf("info_r_%s_us=inf\n", LABEL[i]);
    }
    printf("info_kick_max_us=%.1f\n", kick_us);
    printf("info_iwdg_ticks=%.0f\n", ticks);
    return 0;
}

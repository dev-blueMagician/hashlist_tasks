/* tmon.c - per-job execution time monitor (TMON)
 *
 * Measures the CPU time of each job of a monitored task with the DWT cycle
 * counter and compares it with the task's budget from os_cfg.c. An overrun
 * stores a freeze frame (diag_freeze.c) and resets the controller.
 *
 * Accounting: while a job is active, the time between switch-in and
 * switch-out is added to the job. Time inside handlers that call
 * TMON_ISR_ENTER()/TMON_ISR_EXIT() is subtracted again.
 */
#include "stm32f4xx.h"
#include "FreeRTOS.h"
#include "task.h"
#include "os_cfg.h"
#include "tmon.h"
#include "trace_rec.h"
#include "diag_freeze.h"

typedef struct {
    uint32_t acc;          /* cycles charged to the active job */
    uint32_t budget_cyc;   /* budget_us * cycles per us */
    uint8_t  active;
} tmon_job_t;

static tmon_job_t s_job[TASK_COUNT];
static volatile int32_t  s_running = -1;    /* monitored task that is switched in, or -1 */
static volatile uint32_t s_in_cyc;          /* CYCCNT at its switch-in */
static volatile uint32_t s_isr_cyc;         /* bracketed ISR cycles since then */
static volatile uint32_t s_isr_entry[4];
static volatile uint8_t  s_isr_depth;

void tmon_init(void)
{
    CoreDebug->DEMCR |= CoreDebug_DEMCR_TRCENA_Msk;
    DWT->CYCCNT = 0u;
    DWT->CTRL |= DWT_CTRL_CYCCNTENA_Msk;
    const uint32_t cyc_per_us = SystemCoreClock / 1000000u;
    for (int i = 0; i < TASK_COUNT; i++) {
        s_job[i].budget_cyc = os_task_cfg[i].budget_us * cyc_per_us;
        s_job[i].active = 0u;
    }
}

void tmon_isr_enter(void)
{
    s_isr_entry[s_isr_depth++] = DWT->CYCCNT;
}

void tmon_isr_exit(void)
{
    uint32_t d = DWT->CYCCNT - s_isr_entry[--s_isr_depth];
    if (s_isr_depth == 0u)
        s_isr_cyc += d;
}

static void charge_running(uint32_t now)
{
    if (s_running >= 0 && s_job[s_running].active)
        s_job[s_running].acc += (now - s_in_cyc) - s_isr_cyc;
}

void tmon_switched_in(uint32_t tag)
{
    s_running = (tag > 0u && tag <= TASK_COUNT) ? (int32_t)(tag - 1u) : -1;
    s_isr_cyc = 0u;
    s_in_cyc = DWT->CYCCNT;
}

void tmon_switched_out(uint32_t tag)
{
    (void)tag;
    uint32_t now = DWT->CYCCNT;
    charge_running(now);
    if (s_running >= 0 && s_job[s_running].active
        && s_job[s_running].acc > s_job[s_running].budget_cyc)
        diag_freeze_tmon_overrun((os_task_id_t)s_running, s_job[s_running].acc,
                                 s_job[s_running].budget_cyc);
    s_running = -1;
}

void tmon_job_begin(os_task_id_t id)
{
    taskENTER_CRITICAL();
    s_job[id].acc = 0u;
    s_job[id].active = 1u;
    s_isr_cyc = 0u;
    s_in_cyc = DWT->CYCCNT;
    trace_rec_event(TR_JOB_START, id, 0u);
    taskEXIT_CRITICAL();
}

uint32_t tmon_job_end(os_task_id_t id)
{
    taskENTER_CRITICAL();
    uint32_t now = DWT->CYCCNT;
    charge_running(now);
    s_isr_cyc = 0u;
    s_in_cyc = now;
    s_job[id].active = 0u;
    uint32_t used = s_job[id].acc;
    trace_rec_event(TR_JOB_END, id, 0u);
    trace_rec_event(TR_TMON, id, used);
    taskEXIT_CRITICAL();
    if (used > s_job[id].budget_cyc)
        diag_freeze_tmon_overrun(id, used, s_job[id].budget_cyc);   /* does not return */
    return used;
}

/* FreeRTOS tick hook: catches a runaway job before it blocks */
void vApplicationTickHook(void)
{
    int32_t r = s_running;
    if (r >= 0 && s_job[r].active) {
        uint32_t so_far = s_job[r].acc + (DWT->CYCCNT - s_in_cyc) - s_isr_cyc;
        if (so_far > s_job[r].budget_cyc)
            diag_freeze_tmon_overrun((os_task_id_t)r, so_far, s_job[r].budget_cyc);
    }
}

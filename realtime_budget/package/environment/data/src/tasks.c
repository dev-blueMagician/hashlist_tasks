/* tasks.c - ECP-300 application tasks
 *
 * All tasks are periodic: vTaskDelayUntil() on the 1 kHz tick, then one job
 * bracketed by tmon_job_begin()/tmon_job_end(). Priorities, periods and
 * stack sizes come from os_cfg.c.
 */
#include "FreeRTOS.h"
#include "task.h"
#include "os_cfg.h"
#include "tmon.h"
#include "iwdg.h"
#include "app.h"

static StaticTask_t s_tcb[TASK_COUNT];
static StackType_t  s_stack_speed[384], s_stack_can[512], s_stack_mon[512],
                    s_stack_sup[256], s_stack_nvm[768];
static StackType_t *const s_stacks[TASK_COUNT] = {
    s_stack_speed, s_stack_can, s_stack_mon, s_stack_sup, s_stack_nvm
};

static volatile uint32_t s_alive[TASK_COUNT];

#define PERIODIC_TASK(fn, id, body)                                           \
    static void fn(void *arg)                                                 \
    {                                                                         \
        (void)arg;                                                            \
        TickType_t last = xTaskGetTickCount();                                \
        const TickType_t per = pdMS_TO_TICKS(os_task_cfg[id].period_us / 1000u); \
        for (;;) {                                                            \
            vTaskDelayUntil(&last, per);                                      \
            tmon_job_begin(id);                                               \
            body;                                                             \
            s_alive[id]++;                                                    \
            tmon_job_end(id);                                                 \
        }                                                                     \
    }

PERIODIC_TASK(speedctrl_task, TASK_SPEEDCTRL, speed_loop_step())         /* speed PI, observer, ramp */
PERIODIC_TASK(cancomm_task,   TASK_CANCOMM,   cancomm_step())            /* CanIf main function, Dcm, Tx */
PERIODIC_TASK(monitor_task,   TASK_MONITOR,   monitor_step())            /* temperatures, Vdc, derating, DTC debounce */
PERIODIC_TASK(nvm_task,       TASK_NVM,       nvm_step())                /* EEPROM emulation, freeze frames */

/* Supervisor: checks that every other task completed a job since its last
 * run, and only then refreshes the IWDG. The refresh is the last thing the
 * job does. */
static void supervisor_task(void *arg)
{
    (void)arg;
    static uint32_t seen[TASK_COUNT];
    TickType_t last = xTaskGetTickCount();
    const TickType_t per = pdMS_TO_TICKS(os_task_cfg[TASK_SUPERVISOR].period_us / 1000u);
    for (;;) {
        vTaskDelayUntil(&last, per);
        tmon_job_begin(TASK_SUPERVISOR);
        int ok = 1;
        for (int i = 0; i < TASK_COUNT; i++) {
            if (i == TASK_SUPERVISOR || i == TASK_NVM)
                continue;               /* NvM runs every 100 ms, checked by nvm_step() itself */
            if (s_alive[i] == seen[i])
                ok = 0;
            seen[i] = s_alive[i];
        }
        supervisor_plausibility();      /* RAM/ROM test slice, stack watermarks */
        if (ok)
            iwdg_kick();
        tmon_job_end(TASK_SUPERVISOR);
    }
}

void tasks_create(void)
{
    static TaskFunction_t const fn[TASK_COUNT] = {
        speedctrl_task, cancomm_task, monitor_task, supervisor_task, nvm_task
    };
    for (int i = 0; i < TASK_COUNT; i++) {
        TaskHandle_t h = xTaskCreateStatic(fn[i], os_task_cfg[i].name, os_task_cfg[i].stack_words,
                                           NULL, os_task_cfg[i].priority, s_stacks[i], &s_tcb[i]);
        vTaskSetApplicationTaskTag(h, (TaskHookFunction_t)(uintptr_t)(i + 1));
    }
}

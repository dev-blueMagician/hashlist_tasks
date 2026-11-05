/* tmon.h - per-job execution time monitor (TMON)
 *
 * Every task in os_cfg.c is monitored. A task calls tmon_job_begin() when a
 * job starts and tmon_job_end() when it is done; the scheduler hooks in
 * FreeRTOSConfig.h call tmon_switched_in()/tmon_switched_out().
 *
 * Interrupt time is not part of a task's execution time: interrupt handlers
 * bracket their body with TMON_ISR_ENTER() / TMON_ISR_EXIT().
 */
#ifndef TMON_H
#define TMON_H

#include <stdint.h>
#include "os_cfg.h"

void tmon_init(void);
void tmon_job_begin(os_task_id_t id);
uint32_t tmon_job_end(os_task_id_t id);

/* called from the FreeRTOS trace hooks with the TCB tag (os_task_id_t + 1, 0 = untracked) */
void tmon_switched_in(uint32_t tag);
void tmon_switched_out(uint32_t tag);

void tmon_isr_enter(void);
void tmon_isr_exit(void);

#define TMON_ISR_ENTER()  tmon_isr_enter()
#define TMON_ISR_EXIT()   tmon_isr_exit()

#endif /* TMON_H */

/* trace_hooks.c - glue between the FreeRTOS trace macros, the trace recorder and TMON
 *
 * The recorder writes the events of docs/trace_format.md into a CCM RAM ring
 * buffer; trace_export reads it over SWD. SysTick_Handler (FreeRTOS port.c)
 * is patched with trace_rec_isr_enter/exit so the tick shows in the trace;
 * it has no TMON brackets.
 */
#include "FreeRTOS.h"
#include "task.h"
#include "tmon.h"
#include "trace_rec.h"

void trace_hook_switched_in(void *tcb)
{
    uint32_t tag = (uint32_t)(uintptr_t)xTaskGetApplicationTaskTag((TaskHandle_t)tcb);
    trace_rec_task(TR_TASK_SWITCH_IN, tcb);
    tmon_switched_in(tag);
}

void trace_hook_switched_out(void *tcb)
{
    uint32_t tag = (uint32_t)(uintptr_t)xTaskGetApplicationTaskTag((TaskHandle_t)tcb);
    tmon_switched_out(tag);
    trace_rec_task(TR_TASK_SWITCH_OUT, tcb);
}

void trace_hook_ready(void *tcb)
{
    trace_rec_task(TR_TASK_READY, tcb);
}

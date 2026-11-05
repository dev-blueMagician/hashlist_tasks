/* os_cfg.h - ECP-300 task and watchdog configuration (interface)
 *
 * The values live in os_cfg.c, which is the only file a calibration or
 * maintenance release may change. This header is frozen with the code.
 */
#ifndef OS_CFG_H
#define OS_CFG_H

#include <stdint.h>

typedef enum {
    TASK_SPEEDCTRL,
    TASK_CANCOMM,
    TASK_MONITOR,
    TASK_SUPERVISOR,
    TASK_NVM,
    TASK_COUNT
} os_task_id_t;

typedef struct {
    const char *name;
    uint8_t  priority;      /* FreeRTOS priority, 1..configMAX_PRIORITIES-1; higher runs first */
    uint32_t period_us;     /* release period (vTaskDelayUntil), fixed by SRS-ECP300 */
    uint32_t deadline_us;   /* relative deadline, fixed by SRS-ECP300 */
    uint32_t budget_us;     /* TMON execution budget per job, see tmon.c */
    uint16_t stack_words;
} os_task_cfg_t;

typedef struct {
    uint8_t  prescaler;     /* IWDG_PR value: 0 = /4, 1 = /8, ... 6 = /256 */
    uint16_t reload;        /* IWDG_RLR value, 0..4095 */
} os_iwdg_cfg_t;

extern const os_task_cfg_t os_task_cfg[TASK_COUNT];
extern const os_iwdg_cfg_t os_iwdg_cfg;

#endif /* OS_CFG_H */

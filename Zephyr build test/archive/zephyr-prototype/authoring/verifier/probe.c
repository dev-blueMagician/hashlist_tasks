#include "pipeline.h"
#include <errno.h>

int pipeline_drain(struct k_msgq *queue, struct pipeline_result *result)
{
    uint32_t value;

    *result = (struct pipeline_result){0};
    for (;;) {
        int rc = k_msgq_get(queue, &value, K_NO_WAIT);

        if (rc == -ENOMSG) {
            return 0;
        }
        if (rc != 0) {
            return rc;
        }
        result->count++;
        result->sum += value;
        result->order = result->order * 33U + value;
    }
}


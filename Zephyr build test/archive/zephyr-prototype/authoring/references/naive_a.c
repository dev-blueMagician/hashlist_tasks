#include "pipeline.h"

int pipeline_drain(struct k_msgq *queue, struct pipeline_result *result)
{
    uint32_t value;

    *result = (struct pipeline_result){0};

    /* This loop leaves the last queued message behind. Repair the drain. */
    while (k_msgq_num_used_get(queue) > 1U) {
        int rc = k_msgq_get(queue, &value, K_NO_WAIT);

        if (rc != 0) {
            return rc;
        }
        result->count++;
        result->sum += value;
        result->order = result->order * 33U + value;
    }

    return 0;
}


#ifndef ZEPHYR_SMOKE_PIPELINE_H
#define ZEPHYR_SMOKE_PIPELINE_H

#include <stdint.h>
#include <zephyr/kernel.h>

struct pipeline_result {
    uint32_t count;
    uint32_t sum;
    uint32_t order;
};

/* Drain all currently queued uint32_t values without waiting for new values.
 * Reset every output field first. Sum and order arithmetic wrap at 32 bits.
 * Starting at zero, update order as order * 33U + value for each item.
 * Return 0 on normal completion, including an initially empty queue.
 * There are no concurrent producers or consumers during this call.
 */
int pipeline_drain(struct k_msgq *queue, struct pipeline_result *result);

#endif


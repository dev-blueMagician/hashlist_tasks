#ifndef SMOKE_PIPELINE_H
#define SMOKE_PIPELINE_H
#include "queue.h"

struct pipeline_result {
    uint32_t count;
    uint32_t sum;
    uint32_t order;
};

/* Drain all existing items, resetting every result field on every call.
 * Each item contributes to count, sum, and order = order * 33U + value.
 * Arithmetic wraps modulo 2^32. An empty queue is normal: return zero.
 * There are no concurrent queue users. Do not print or access UART here.
 */
int pipeline_drain(struct value_queue *queue, struct pipeline_result *result);
#endif


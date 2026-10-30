#ifndef SMOKE_QUEUE_H
#define SMOKE_QUEUE_H
#include <stdint.h>

#define QUEUE_CAPACITY 8U
#define QUEUE_EMPTY (-1)

struct value_queue {
    uint32_t values[QUEUE_CAPACITY];
    uint32_t head;
    uint32_t count;
};

static inline void queue_init(struct value_queue *queue)
{
    queue->head = 0U;
    queue->count = 0U;
}

static inline int queue_push(struct value_queue *queue, uint32_t value)
{
    if (queue->count == QUEUE_CAPACITY) {
        return -2;
    }
    queue->values[(queue->head + queue->count) & (QUEUE_CAPACITY - 1U)] = value;
    queue->count++;
    return 0;
}

static inline int queue_pop(struct value_queue *queue, uint32_t *value)
{
    if (queue->count == 0U) {
        return QUEUE_EMPTY;
    }
    *value = queue->values[queue->head];
    queue->head = (queue->head + 1U) & (QUEUE_CAPACITY - 1U);
    queue->count--;
    return 0;
}
#endif


#include <stdint.h>
#include "uart.h"

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

int pipeline_drain(struct value_queue *queue, struct pipeline_result *result)
{
    uint32_t value;
    result->count = 0U;
    result->sum = 0U;
    result->order = 0U;
    for (;;) {
        int rc = queue_pop(queue, &value);
        if (rc == QUEUE_EMPTY) {
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

static void uart_init(void)
{
    /* Enable RX/TX without flushing input already waiting on QEMU's UART. */
    *(volatile uint32_t *)(UART0_BASE + 0x30U) = 0x301U;
}

static uint8_t receive_byte(void)
{
    while ((UART0_FR & UART_FR_RXFE) != 0U) {
    }
    return (uint8_t)UART0_DR;
}

static void send_byte(uint8_t value)
{
    while ((UART0_FR & UART_FR_TXFF) != 0U) {
    }
    UART0_DR = value;
}

static uint32_t receive_u32(void)
{
    uint32_t value = 0U;
    for (uint32_t i = 0U; i < 4U; ++i) {
        value |= (uint32_t)receive_byte() << (8U * i);
    }
    return value;
}

static void send_u32(uint32_t value)
{
    for (uint32_t i = 0U; i < 4U; ++i) {
        send_byte((uint8_t)(value >> (8U * i)));
    }
}

void app_main(void)
{
    static const char banner[] = "FIRMWARE_READY v1\n";
    struct value_queue queue;
    struct pipeline_result result;

    uart_init();
    for (uint32_t i = 0U; i < sizeof(banner) - 1U; ++i) {
        send_byte((uint8_t)banner[i]);
    }
    for (;;) {
        uint8_t sequence = receive_byte();
        uint8_t count = receive_byte();
        queue_init(&queue);
        result.count = 0xdeadbeefU;
        result.sum = 0xdeadbeefU;
        result.order = 0xdeadbeefU;

        /* Requests outside the documented 0..8 item range are ignored. */
        for (uint32_t i = 0U; i < count; ++i) {
            uint32_t value = receive_u32();
            if (i < QUEUE_CAPACITY) {
                (void)queue_push(&queue, value);
            }
        }
        int rc = count <= QUEUE_CAPACITY ? pipeline_drain(&queue, &result) : -2;
        /* Response: magic, sequence, count, LE sum, LE order, remaining, rc.
         * Wider invalid count/status results saturate rather than wrap to a
         * potentially valid byte value.
         */
        send_byte(0xa5U);
        send_byte(sequence);
        send_byte(result.count <= QUEUE_CAPACITY ? (uint8_t)result.count : 0xffU);
        send_u32(result.sum);
        send_u32(result.order);
        send_byte(queue.count <= QUEUE_CAPACITY ? (uint8_t)queue.count : 0xffU);
        send_byte(rc == 0 ? 0U : 0xffU);
    }
}

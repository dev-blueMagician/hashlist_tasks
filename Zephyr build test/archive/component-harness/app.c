#include "pipeline.h"
#include "uart.h"

static void uart_init(void)
{
    /* PL011-compatible UART0 in QEMU's lm3s6965evb model. */
    volatile uint32_t *control = (volatile uint32_t *)(UART0_BASE + 0x30U);
    *control = 0U;
    *(volatile uint32_t *)(UART0_BASE + 0x24U) = 6U;
    *(volatile uint32_t *)(UART0_BASE + 0x28U) = 33U;
    *(volatile uint32_t *)(UART0_BASE + 0x2cU) = 0x70U;
    *control = 0x301U;
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


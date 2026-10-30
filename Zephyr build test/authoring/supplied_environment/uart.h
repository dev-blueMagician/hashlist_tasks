/* UART0 of the Stellaris LM3S6965, as QEMU's lm3s6965evb models it. */
#ifndef UART_H
#define UART_H
#include <stdint.h>
#define UART0_BASE 0x4000C000u
#define UART0_DR (*(volatile uint32_t *)(UART0_BASE + 0x00))
#define UART0_FR (*(volatile uint32_t *)(UART0_BASE + 0x18))
#define UART_FR_RXFE 0x10u
#define UART_FR_TXFF 0x20u
#endif

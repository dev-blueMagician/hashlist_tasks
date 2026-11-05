/* Author probe: prints what the bench model reports, to compare with the service log. */
#include <stdint.h>

#define REG(a)      (*(volatile uint32_t *)(a))
#define UART0_DR    REG(0x4000C000)

static void put_hex(const char *name, uint32_t v)
{
    static const char hex[] = "0123456789ABCDEF";
    int i;

    while (*name)
        UART0_DR = (uint8_t)*name++;
    UART0_DR = ' ';
    for (i = 28; i >= 0; i -= 4)
        UART0_DR = (uint8_t)hex[(v >> i) & 0xFu];
    UART0_DR = '\n';
}

void app_main(void)
{
    put_hex("DID0", REG(0x400FE000));
    put_hex("DID1", REG(0x400FE004));
    put_hex("DC0", REG(0x400FE008));
    put_hex("DC1", REG(0x400FE010));
    put_hex("DC2", REG(0x400FE014));
    put_hex("RCC", REG(0x400FE060));
    put_hex("RCC2", REG(0x400FE070));
    put_hex("LDOPCTL", REG(0x400FE034));
    for (;;)
        ;
}

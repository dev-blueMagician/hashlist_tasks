/*
 * microSD block service for the EK-LM3S6965 evaluation board.
 *
 * The host drives the card through UART0 (virtual COM port, 115200 8N1).
 * One command per line ('\n'), answered with one line:
 *
 *   I                    initialise the card  -> "OK SDSC", "OK SDHC", "OK SDV1" or "ERR <n>"
 *   R <lba>              read block <lba>     -> "DATA <1024 hex digits>" or "ERR <n>"
 *   W <lba> <1024 hex>   write block <lba>    -> "OK" or "ERR <n>"
 *
 * <lba> is a decimal 512-byte block number. "READY" is printed once after
 * reset. A malformed line is answered with "ERR 0".
 */
#include <stdint.h>

#define REG(a)          (*(volatile uint32_t *)(a))

/* System control */
#define SYSCTL_DID0     REG(0x400FE000)
#define SYSCTL_LDOPCTL  REG(0x400FE034)
#define SYSCTL_RIS      REG(0x400FE050)
#define SYSCTL_RCC      REG(0x400FE060)
#define SYSCTL_RCC2     REG(0x400FE070)
#define SYSCTL_RCGC1    REG(0x400FE104)
#define SYSCTL_RCGC2    REG(0x400FE108)

#define RCGC1_UART0     0x00000001u
#define RCGC1_SSI0      0x00000010u
#define RCGC2_GPIOA     0x00000001u
#define RCGC2_GPIOD     0x00000008u

/* GPIO; the data register is addressed through a bit mask in address bits [9:2] */
#define GPIOA_BASE      0x40004000u
#define GPIOD_BASE      0x40007000u
#define GPIO_DATA(b, m) REG((b) + ((uint32_t)(m) << 2))
#define GPIO_DIR(b)     REG((b) + 0x400u)
#define GPIO_AFSEL(b)   REG((b) + 0x420u)
#define GPIO_DEN(b)     REG((b) + 0x51Cu)

/* UART0 */
#define UART0_DR        REG(0x4000C000)
#define UART0_FR        REG(0x4000C018)
#define UART0_IBRD      REG(0x4000C024)
#define UART0_FBRD      REG(0x4000C028)
#define UART0_LCRH      REG(0x4000C02C)
#define UART0_CTL       REG(0x4000C030)
#define UART_FR_RXFE    0x10u
#define UART_FR_TXFF    0x20u

/* SSI0 */
#define SSI0_CR0        REG(0x40008000)
#define SSI0_CR1        REG(0x40008004)
#define SSI0_DR         REG(0x40008008)
#define SSI0_SR         REG(0x4000800C)
#define SSI0_CPSR       REG(0x40008010)
#define SSI_CR1_SSE     0x02u
#define SSI_SR_TNF      0x02u
#define SSI_SR_RNE      0x04u

#define SD_CS           0x01u           /* PD0, card select, active low */

enum { CARD_NONE = -1, CARD_SDSC, CARD_SDHC, CARD_SDV1 };
static const char *const card_name[] = { "SDSC", "SDHC", "SDV1" };

static int card = CARD_NONE;

/* ---- clock ---------------------------------------------------------------- */

/* The prototype runs from the internal oscillator, the clock source after reset. */
#define SYSCLK_HZ       12000000u

static uint32_t clock_init(void)
{
    return SYSCLK_HZ;
}

/* ---- UART0 ---------------------------------------------------------------- */

static void uart_init(uint32_t sysclk)
{
    uint32_t div64;

    SYSCTL_RCGC1 |= RCGC1_UART0;
    SYSCTL_RCGC2 |= RCGC2_GPIOA;
    (void)SYSCTL_RCGC2;                 /* a few clocks before the modules are touched */

    GPIO_AFSEL(GPIOA_BASE) |= 0x03;     /* PA0 U0RX, PA1 U0TX */
    GPIO_DEN(GPIOA_BASE) |= 0x03;

    /* divisor = sysclk / (16 * 115200) in 1/64 steps, rounded */
    div64 = (sysclk * 4u + 57600u) / 115200u;
    UART0_CTL = 0;
    UART0_IBRD = div64 >> 6;
    UART0_FBRD = div64 & 0x3Fu;
    UART0_LCRH = 0x70;                  /* 8 data bits, no parity, 1 stop bit, FIFOs on */
    UART0_CTL = 0x301;                  /* UARTEN, TXE, RXE */
}

static void uart_putc(char c)
{
    while (UART0_FR & UART_FR_TXFF)
        ;
    UART0_DR = (uint8_t)c;
}

static void uart_puts(const char *s)
{
    while (*s)
        uart_putc(*s++);
}

static void uart_putu(uint32_t v)
{
    char buf[11];
    int n = 0;

    do {
        buf[n++] = (char)('0' + v % 10u);
        v /= 10u;
    } while (v);
    while (n)
        uart_putc(buf[--n]);
}

static char uart_getc(void)
{
    while (UART0_FR & UART_FR_RXFE)
        ;
    return (char)(UART0_DR & 0xFFu);
}

/* ---- SSI0 ----------------------------------------------------------------- */

static void ssi_init(uint32_t sysclk)
{
    SYSCTL_RCGC1 |= RCGC1_SSI0;
    SYSCTL_RCGC2 |= RCGC2_GPIOA | RCGC2_GPIOD;
    (void)SYSCTL_RCGC2;

    /* SSI0 on PA2 (clock), PA3 (frame), PA4 (rx) and PA5 (tx) */
    GPIO_AFSEL(GPIOA_BASE) |= 0x3C;
    GPIO_DEN(GPIOA_BASE) |= 0x3C;

    /* PD0 drives the card select; idle high */
    GPIO_DIR(GPIOD_BASE) |= SD_CS;
    GPIO_DEN(GPIOD_BASE) |= SD_CS;
    GPIO_DATA(GPIOD_BASE, SD_CS) = SD_CS;

    /* master, Freescale SPI mode 0, 8-bit frames, 400 kHz for card identification */
    SSI0_CR1 = 0;
    SSI0_CPSR = sysclk / 400000u;
    SSI0_CR0 = 0x0007;
    SSI0_CR1 = SSI_CR1_SSE;
}

/* Raise the bit rate once the card has left the identification phase. */
static void ssi_fast(uint32_t sysclk)
{
    (void)sysclk;
    SSI0_CPSR = 2;                      /* half the system clock */
}

static uint8_t spi(uint8_t out)
{
    while (!(SSI0_SR & SSI_SR_TNF))
        ;
    SSI0_DR = out;
    while (!(SSI0_SR & SSI_SR_RNE))
        ;
    return (uint8_t)SSI0_DR;
}

/* ---- SD card in SPI mode -------------------------------------------------- */

static void card_select(void)
{
    GPIO_DATA(GPIOD_BASE, SD_CS) = 0;
    spi(0xFF);
}

static void card_deselect(void)
{
    GPIO_DATA(GPIOD_BASE, SD_CS) = SD_CS;
    spi(0xFF);                          /* lets the card release its data out line */
}

/* Send a command frame and return R1, or 0xFF if the card does not answer. */
static uint8_t sd_command(uint8_t cmd, uint32_t arg, uint8_t crc)
{
    uint8_t r1;
    int n;

    for (n = 0; n < 1000; n++)                          /* >= 8 clocks since the last response, card not busy */
        if (spi(0xFF) == 0xFF)
            break;
    spi((uint8_t)(0x40u | cmd));
    spi((uint8_t)(arg >> 24));
    spi((uint8_t)(arg >> 16));
    spi((uint8_t)(arg >> 8));
    spi((uint8_t)arg);
    spi(crc);
    for (n = 0; n < 10; n++) {
        r1 = spi(0xFF);
        if (!(r1 & 0x80u))
            return r1;
    }
    return 0xFF;
}

static int sd_init(uint32_t sysclk)
{
    uint8_t r1 = 0xFF, r7[4];
    int n;

    /* at least 74 clocks with the card deselected */
    GPIO_DATA(GPIOD_BASE, SD_CS) = SD_CS;
    for (n = 0; n < 10; n++)
        spi(0xFF);

    card_select();
    if (sd_command(0, 0, 0x95) != 0x01) {               /* GO_IDLE_STATE */
        card_deselect();
        return -1;
    }
    if (sd_command(8, 0x000001AAu, 0x87) != 0x01) {     /* SEND_IF_COND */
        card_deselect();
        return -2;
    }
    for (n = 0; n < 4; n++)
        r7[n] = spi(0xFF);
    if (r7[3] != 0xAA) {
        card_deselect();
        return -3;
    }
    for (n = 0; n < 1000; n++) {                        /* SD_SEND_OP_COND until ready */
        sd_command(55, 0, 0x01);
        r1 = sd_command(41, 0x40000000u, 0x01);
        if (r1 == 0x00)
            break;
    }
    if (r1 != 0x00) {
        card_deselect();
        return -4;
    }
    r1 = sd_command(16, 512, 0x01);                     /* SET_BLOCKLEN */
    card_deselect();
    if (r1 != 0x00)
        return -5;

    ssi_fast(sysclk);
    return CARD_SDSC;
}

static int sd_read(uint32_t lba, uint8_t *buf)
{
    uint8_t tok = 0xFF;
    int n;

    card_select();
    if (sd_command(17, lba * 512u, 0x01) != 0x00) {     /* READ_SINGLE_BLOCK */
        card_deselect();
        return -1;
    }
    for (n = 0; n < 10000 && tok == 0xFF; n++)
        tok = spi(0xFF);
    if (tok != 0xFE) {
        card_deselect();
        return -2;
    }
    for (n = 0; n < 512; n++)
        buf[n] = spi(0xFF);
    spi(0xFF);                                          /* CRC, not checked */
    spi(0xFF);
    card_deselect();
    return 0;
}

static int sd_write(uint32_t lba, const uint8_t *buf)
{
    uint8_t resp;
    int n;

    card_select();
    if (sd_command(24, lba * 512u, 0x01) != 0x00) {     /* WRITE_BLOCK */
        card_deselect();
        return -1;
    }
    spi(0xFF);
    spi(0xFE);                                          /* start block token */
    for (n = 0; n < 512; n++)
        spi(buf[n]);
    spi(0xFF);                                          /* CRC, not checked by the card */
    spi(0xFF);
    resp = spi(0xFF);
    if ((resp & 0x1Fu) != 0x05) {                       /* data accepted */
        card_deselect();
        return -2;
    }
    for (n = 0; n < 100000; n++)                        /* busy while programming */
        if (spi(0xFF) == 0xFF)
            break;
    card_deselect();
    return 0;
}

/* ---- host protocol -------------------------------------------------------- */

static char line[1100];
static uint8_t block[512];

static int read_line(void)
{
    int n = 0;
    char c;

    for (;;) {
        c = uart_getc();
        if (c == '\r')
            continue;
        if (c == '\n')
            break;
        if (n < (int)sizeof(line) - 1)
            line[n++] = c;
    }
    line[n] = 0;
    return n;
}

static int hexval(char c)
{
    if (c >= '0' && c <= '9')
        return c - '0';
    if (c >= 'a' && c <= 'f')
        return c - 'a' + 10;
    if (c >= 'A' && c <= 'F')
        return c - 'A' + 10;
    return -1;
}

/* Parse a decimal number at *p; returns 0 on success and advances *p. */
static int parse_u32(const char **p, uint32_t *out)
{
    const char *s = *p;
    uint32_t v = 0;

    while (*s == ' ')
        s++;
    if (*s < '0' || *s > '9')
        return -1;
    while (*s >= '0' && *s <= '9') {
        if (v > 429496729u || (v == 429496729u && *s > '5'))
            return -1;
        v = v * 10u + (uint32_t)(*s++ - '0');
    }
    *p = s;
    *out = v;
    return 0;
}

static void reply_err(int code)
{
    uart_puts("ERR ");
    uart_putu((uint32_t)(code < 0 ? -code : code));
    uart_putc('\n');
}

static void cmd_read(const char *p)
{
    static const char hex[] = "0123456789abcdef";
    uint32_t lba;
    int n, r;

    if (parse_u32(&p, &lba) || *p) {
        reply_err(0);
        return;
    }
    if (card == CARD_NONE) {
        reply_err(9);
        return;
    }
    r = sd_read(lba, block);
    if (r) {
        reply_err(r);
        return;
    }
    uart_puts("DATA ");
    for (n = 0; n < 512; n++) {
        uart_putc(hex[block[n] >> 4]);
        uart_putc(hex[block[n] & 0x0F]);
    }
    uart_putc('\n');
}

static void cmd_write(const char *p)
{
    uint32_t lba;
    int n, hi, lo, r;

    if (parse_u32(&p, &lba) || *p++ != ' ') {
        reply_err(0);
        return;
    }
    for (n = 0; n < 512; n++) {
        hi = hexval(p[2 * n]);
        lo = hi < 0 ? -1 : hexval(p[2 * n + 1]);
        if (lo < 0) {
            reply_err(0);
            return;
        }
        block[n] = (uint8_t)(hi << 4 | lo);
    }
    if (p[1024]) {
        reply_err(0);
        return;
    }
    if (card == CARD_NONE) {
        reply_err(9);
        return;
    }
    r = sd_write(lba, block);
    if (r) {
        reply_err(r);
        return;
    }
    uart_puts("OK\n");
}

void app_main(void)
{
    uint32_t sysclk = clock_init();
    int r;

    uart_init(sysclk);
    ssi_init(sysclk);
    uart_puts("READY\n");

    for (;;) {
        read_line();
        if (line[0] == 'I' && line[1] == 0) {
            card = CARD_NONE;
            r = sd_init(sysclk);
            if (r < 0) {
                reply_err(r);
            } else {
                card = r;
                uart_puts("OK ");
                uart_puts(card_name[card]);
                uart_putc('\n');
            }
        } else if (line[0] == 'R' && line[1] == ' ') {
            cmd_read(line + 1);
        } else if (line[0] == 'W' && line[1] == ' ') {
            cmd_write(line + 1);
        } else {
            reply_err(0);
        }
    }
}

var e=`20261006T000000Z`,t=`RUN . /etc/os-release && [ "$ID" = debian ] && [ -f /etc/apt/sources.list.d/debian.sources ] && printf 'Types: deb\\nURIs: http://snapshot.debian.org/archive/debian/${e}\\nSuites: %s %s-updates\\nComponents: main\\nSigned-By: /usr/share/keyrings/debian-archive-keyring.gpg\\nCheck-Valid-Until: no\\n\\nTypes: deb\\nURIs: http://snapshot.debian.org/archive/debian-security/${e}\\nSuites: %s-security\\nComponents: main\\nSigned-By: /usr/share/keyrings/debian-archive-keyring.gpg\\nCheck-Valid-Until: no\\n' "$VERSION_CODENAME" "$VERSION_CODENAME" "$VERSION_CODENAME" > /etc/apt/sources.list.d/debian.sources; true`,n=`pip==26.2.1`,r=`${e.slice(0,4)}-${e.slice(4,6)}-${e.slice(6,8)}T00:00:00Z`,i=e=>`RUN pip install --no-cache-dir ${n} && pip install --no-cache-dir --uploaded-prior-to ${r} ${e}`,a=e=>e.replace(/^RUN apt-get update/gm,`${t}\nRUN apt-get update`),o=e=>`renode`in e&&!!e.renode,s=e=>o(e)?`Renode`:`QEMU`,c=(e,t,n)=>`/* UART0 of the ${e}, as QEMU's ${t} models it. */
#ifndef UART_H
#define UART_H
#include <stdint.h>

#define UART0_BASE   ${n}u
#define UART0_DR     (*(volatile uint32_t *)(UART0_BASE + 0x00))  /* data */
#define UART0_FR     (*(volatile uint32_t *)(UART0_BASE + 0x18))  /* flags */

#define UART_FR_RXFE 0x10u   /* receive FIFO empty */
#define UART_FR_TXFF 0x20u   /* transmit FIFO full */
#endif
`,l=(e,t)=>`/* The CMSDK UART of QEMU's ${e}. The transmitter and receiver are off until CTRL turns them on. */
#ifndef UART_H
#define UART_H
#include <stdint.h>

#define UART_BASE      ${t}u
#define UART_DATA      (*(volatile uint32_t *)(UART_BASE + 0x00))  /* data */
#define UART_STATE     (*(volatile uint32_t *)(UART_BASE + 0x04))  /* status */
#define UART_CTRL      (*(volatile uint32_t *)(UART_BASE + 0x08))  /* control */
#define UART_BAUDDIV   (*(volatile uint32_t *)(UART_BASE + 0x10))  /* baud divisor, must be non-zero */

#define UART_STATE_TXFULL 0x1u   /* transmit buffer full */
#define UART_STATE_RXFULL 0x2u   /* a received byte is waiting */
#define UART_CTRL_TXEN    0x1u
#define UART_CTRL_RXEN    0x2u
#endif
`,u=`/* The UART of the nRF51822, as QEMU's microbit models it. Events are set by the chip and cleared by you. */
#ifndef UART_H
#define UART_H
#include <stdint.h>

#define UART_BASE      0x40002000u
#define UART_REG(o)    (*(volatile uint32_t *)(UART_BASE + (o)))
#define UART_STARTRX   UART_REG(0x000)   /* task: start receiving */
#define UART_STARTTX   UART_REG(0x008)   /* task: start transmitting */
#define UART_RXDRDY    UART_REG(0x108)   /* event: a byte is in RXD */
#define UART_TXDRDY    UART_REG(0x11C)   /* event: the byte written to TXD has gone */
#define UART_ENABLE    UART_REG(0x500)   /* 4 turns the UART on */
#define UART_RXD       UART_REG(0x518)
#define UART_TXD       UART_REG(0x51C)
#endif
`,d=(e,t,n)=>`/* The console UART of the ${e}, as QEMU's ${t} models it: a 16550 with its registers 4 bytes apart. */
#ifndef UART_H
#define UART_H
#include <stdint.h>

#define UART_BASE      ${n}u
#define UART_RBR       (*(volatile uint32_t *)(UART_BASE + 0x00))  /* received byte, on read */
#define UART_THR       (*(volatile uint32_t *)(UART_BASE + 0x00))  /* byte to send, on write */
#define UART_LSR       (*(volatile uint32_t *)(UART_BASE + 0x14))  /* line status */

#define UART_LSR_DR    0x01u   /* a received byte is waiting */
#define UART_LSR_THRE  0x20u   /* the transmit register is empty */
#endif
`,f=(e,t)=>`/* USART0 of the ${e}, as QEMU's ${t} models it.
 * QEMU drops a byte that arrives before UCSRB has RXEN set, so the firmware
 * has to be running before anything is sent to it. */
#ifndef UART_H
#define UART_H
#include <stdint.h>

#define USART0_UCSRA (*(volatile uint8_t *)0xC0)  /* status */
#define USART0_UCSRB (*(volatile uint8_t *)0xC1)  /* control */
#define USART0_UDR   (*(volatile uint8_t *)0xC6)  /* data */

#define USART_UCSRA_RXC  0x80u   /* a received byte is waiting */
#define USART_UCSRA_UDRE 0x20u   /* the data register is empty */
#define USART_UCSRB_RXEN 0x10u
#define USART_UCSRB_TXEN 0x08u
#endif
`,p=` * Build with -ffreestanding: there is no C library, and <stdint.h> is GCC's own. */`,ee=`/* UART0 of the SiFive FE310, as QEMU's sifive_e models it.
${p}
#ifndef UART_H
#define UART_H
#include <stdint.h>

#define UART_BASE      0x10013000u
#define UART_TXDATA    (*(volatile uint32_t *)(UART_BASE + 0x00))  /* write a byte; reads FULL while it cannot take one */
#define UART_RXDATA    (*(volatile uint32_t *)(UART_BASE + 0x04))  /* read: EMPTY, or the byte in bits 7:0 */
#define UART_TXCTRL    (*(volatile uint32_t *)(UART_BASE + 0x08))
#define UART_RXCTRL    (*(volatile uint32_t *)(UART_BASE + 0x0C))

#define UART_TXDATA_FULL  0x80000000u
#define UART_RXDATA_EMPTY 0x80000000u
#define UART_TXCTRL_TXEN  0x1u
#define UART_RXCTRL_RXEN  0x1u
#endif
`,te=`/* The UART of the OpenTitan earlgrey, as QEMU's opentitan models it.
${p}
#ifndef UART_H
#define UART_H
#include <stdint.h>

#define UART_BASE      0x40000000u
#define UART_CTRL      (*(volatile uint32_t *)(UART_BASE + 0x10))  /* control */
#define UART_STATUS    (*(volatile uint32_t *)(UART_BASE + 0x14))  /* status */
#define UART_RDATA     (*(volatile uint32_t *)(UART_BASE + 0x18))  /* received byte */
#define UART_WDATA     (*(volatile uint32_t *)(UART_BASE + 0x1C))  /* byte to send */

#define UART_CTRL_TX          0x1u
#define UART_CTRL_RX          0x2u
#define UART_STATUS_TXFULL    0x01u
#define UART_STATUS_RXEMPTY   0x20u
#endif
`,m=(e,t,n,r)=>`/* ${r} of the ${e}, as Renode's ${t} models it.
 * Renode drops a byte that arrives before CR1 has UE and RE set, so the firmware
 * has to be running before anything is sent to it. */
#ifndef UART_H
#define UART_H
#include <stdint.h>

#define USART_BASE   ${n}u
#define USART_CR1    (*(volatile uint32_t *)(USART_BASE + 0x00))  /* control 1 */
#define USART_ISR    (*(volatile uint32_t *)(USART_BASE + 0x1C))  /* status */
#define USART_RDR    (*(volatile uint32_t *)(USART_BASE + 0x24))  /* received byte */
#define USART_TDR    (*(volatile uint32_t *)(USART_BASE + 0x28))  /* byte to send */

#define USART_CR1_UE   0x0001u
#define USART_CR1_RE   0x0004u
#define USART_CR1_TE   0x0008u
#define USART_ISR_RXNE 0x20u    /* a received byte is waiting */
#define USART_ISR_TXE  0x80u    /* the transmit register is empty */
#endif
`,ne=(e,t,n)=>`/* SCI0 of the Renesas ${e}, as Renode's ${t} models it,
 * in asynchronous mode without its FIFO. */
#ifndef UART_H
#define UART_H
#include <stdint.h>

#define SCI_BASE     ${n}u
#define SCI_SMR      (*(volatile uint8_t *)(SCI_BASE + 0x00))  /* serial mode */
#define SCI_BRR      (*(volatile uint8_t *)(SCI_BASE + 0x01))  /* bit rate */
#define SCI_SCR      (*(volatile uint8_t *)(SCI_BASE + 0x02))  /* serial control */
#define SCI_TDR      (*(volatile uint8_t *)(SCI_BASE + 0x03))  /* byte to send */
#define SCI_SSR      (*(volatile uint8_t *)(SCI_BASE + 0x04))  /* serial status */
#define SCI_RDR      (*(volatile uint8_t *)(SCI_BASE + 0x05))  /* received byte */

#define SCI_SCR_TE   0x20u
#define SCI_SCR_RE   0x10u
#define SCI_SSR_TDRE 0x80u   /* TDR can take a byte */
#define SCI_SSR_RDRF 0x40u   /* a byte is waiting in RDR; write 0 to clear it */
#endif
`,h=(e,t,n,r=`USART1`,i=`QEMU`)=>`/* ${r} of the ${e}, as ${i}'s ${t} models it.
 * ${i} drops a byte that arrives before CR1 has UE and RE set, so the firmware
 * has to be running before anything is sent to it. */
#ifndef UART_H
#define UART_H
#include <stdint.h>

#define USART_BASE   ${n}u
#define USART_SR     (*(volatile uint32_t *)(USART_BASE + 0x00))  /* status */
#define USART_DR     (*(volatile uint32_t *)(USART_BASE + 0x04))  /* data */
#define USART_CR1    (*(volatile uint32_t *)(USART_BASE + 0x0C))  /* control 1 */

#define USART_SR_RXNE 0x20u    /* a received byte is waiting */
#define USART_SR_TXE  0x80u    /* the transmit register is empty */
#define USART_CR1_RE  0x0004u
#define USART_CR1_TE  0x0008u
#define USART_CR1_UE  0x2000u
#endif
`,g=`#include <stdint.h>
#include "uart.h"

/* What /app/firmware.c would be: here, echo every byte back plus one. */
void app_main(void)
{
    for (;;) {
        while (UART0_FR & UART_FR_RXFE) ;
        uint32_t c = UART0_DR & 0xFF;
        while (UART0_FR & UART_FR_TXFF) ;
        UART0_DR = c + 1;
    }
}`,_=`#include <stdint.h>
#include "uart.h"

/* What /app/firmware.c would be: here, echo every byte back plus one. */
void app_main(void)
{
    UART_BAUDDIV = 16;
    UART_CTRL = UART_CTRL_TXEN | UART_CTRL_RXEN;
    for (;;) {
        while (!(UART_STATE & UART_STATE_RXFULL)) ;
        uint32_t c = UART_DATA & 0xFF;
        while (UART_STATE & UART_STATE_TXFULL) ;
        UART_DATA = c + 1;
    }
}`,re=`#include <stdint.h>
#include "uart.h"

/* What /app/firmware.c would be: here, echo every byte back plus one. */
void app_main(void)
{
    UART_ENABLE = 4;
    UART_STARTRX = 1;
    UART_STARTTX = 1;
    for (;;) {
        while (!UART_RXDRDY) ;
        UART_RXDRDY = 0;
        uint32_t c = UART_RXD & 0xFF;
        UART_TXDRDY = 0;
        UART_TXD = c + 1;
        while (!UART_TXDRDY) ;
    }
}`,v=`#include <stdint.h>
#include "uart.h"

/* What /app/firmware.c would be: here, echo every byte back plus one. */
void app_main(void)
{
    for (;;) {
        while (!(UART_LSR & UART_LSR_DR)) ;
        uint32_t c = UART_RBR & 0xFF;
        while (!(UART_LSR & UART_LSR_THRE)) ;
        UART_THR = c + 1;
    }
}`,y=`#include <stdint.h>
#include "uart.h"

/* What /app/firmware.c would be: here, echo every byte back plus one. */
void app_main(void)
{
    USART0_UCSRB = USART_UCSRB_RXEN | USART_UCSRB_TXEN;
    for (;;) {
        while (!(USART0_UCSRA & USART_UCSRA_RXC)) ;
        uint8_t c = USART0_UDR;
        while (!(USART0_UCSRA & USART_UCSRA_UDRE)) ;
        USART0_UDR = c + 1;
    }
}`,ie=`#include <stdint.h>
#include "uart.h"

/* What /app/firmware.c would be: here, echo every byte back plus one. */
void app_main(void)
{
    UART_TXCTRL = UART_TXCTRL_TXEN;
    UART_RXCTRL = UART_RXCTRL_RXEN;
    for (;;) {
        uint32_t r;
        while ((r = UART_RXDATA) & UART_RXDATA_EMPTY) ;
        while (UART_TXDATA & UART_TXDATA_FULL) ;
        UART_TXDATA = (r & 0xFF) + 1;
    }
}`,ae=`#include <stdint.h>
#include "uart.h"

/* What /app/firmware.c would be: here, echo every byte back plus one. */
void app_main(void)
{
    UART_CTRL = UART_CTRL_TX | UART_CTRL_RX;
    for (;;) {
        while (UART_STATUS & UART_STATUS_RXEMPTY) ;
        uint32_t c = UART_RDATA & 0xFF;
        while (UART_STATUS & UART_STATUS_TXFULL) ;
        UART_WDATA = c + 1;
    }
}`,b=`#include <stdint.h>
#include "uart.h"

/* What /app/firmware.c would be: here, echo every byte back plus one. */
void app_main(void)
{
    USART_CR1 = USART_CR1_UE | USART_CR1_TE | USART_CR1_RE;
    for (;;) {
        while (!(USART_ISR & USART_ISR_RXNE)) ;
        uint32_t c = USART_RDR & 0xFF;
        while (!(USART_ISR & USART_ISR_TXE)) ;
        USART_TDR = c + 1;
    }
}`,x=`#include <stdint.h>
#include "uart.h"

/* What /app/firmware.c would be: here, echo every byte back plus one. */
void app_main(void)
{
    SCI_SCR = SCI_SCR_TE | SCI_SCR_RE;
    for (;;) {
        while (!(SCI_SSR & SCI_SSR_RDRF)) ;
        uint8_t c = SCI_RDR;
        SCI_SSR = SCI_SSR & ~SCI_SSR_RDRF;
        while (!(SCI_SSR & SCI_SSR_TDRE)) ;
        SCI_TDR = c + 1;
    }
}`,S=`#include <stdint.h>
#include "uart.h"

/* What /app/firmware.c would be: here, echo every byte back plus one. */
void app_main(void)
{
    USART_CR1 = USART_CR1_UE | USART_CR1_TE | USART_CR1_RE;
    for (;;) {
        while (!(USART_SR & USART_SR_RXNE)) ;
        uint32_t c = USART_DR & 0xFF;
        while (!(USART_SR & USART_SR_TXE)) ;
        USART_DR = c + 1;
    }
}`,C=[{id:`lm3s6965evb`,name:`Stellaris LM3S6965 · Cortex-M3`,machine:`lm3s6965evb`,cpu:`cortex-m3`,flash:[`0x00000000`,`256K`],ram:[`0x20000000`,`64K`],wait:0,uart:c(`Stellaris LM3S6965`,`lm3s6965evb`,`0x4000C000`),echo:g},{id:`lm3s811evb`,name:`Stellaris LM3S811 · Cortex-M3`,machine:`lm3s811evb`,cpu:`cortex-m3`,flash:[`0x00000000`,`64K`],ram:[`0x20000000`,`8K`],wait:0,uart:c(`Stellaris LM3S811`,`lm3s811evb`,`0x4000C000`),echo:g},{id:`mps2-an385`,name:`ARM MPS2 AN385 · Cortex-M3`,machine:`mps2-an385`,cpu:`cortex-m3`,flash:[`0x00000000`,`4M`],ram:[`0x20000000`,`4M`],wait:0,uart:l(`mps2-an385`,`0x40004000`),echo:_},{id:`mps2-an511`,name:`ARM MPS2 AN511 · Cortex-M3`,machine:`mps2-an511`,cpu:`cortex-m3`,flash:[`0x00000000`,`256K`],ram:[`0x20000000`,`128K`],wait:0,uart:l(`mps2-an511`,`0x40004000`),echo:_},{id:`mps2-an386`,name:`ARM MPS2 AN386 · Cortex-M4`,machine:`mps2-an386`,cpu:`cortex-m4`,flash:[`0x00000000`,`4M`],ram:[`0x20000000`,`4M`],wait:0,uart:l(`mps2-an386`,`0x40004000`),echo:_},{id:`mps2-an500`,name:`ARM MPS2 AN500 · Cortex-M7`,machine:`mps2-an500`,cpu:`cortex-m7`,flash:[`0x00000000`,`4M`],ram:[`0x20000000`,`4M`],wait:0,uart:l(`mps2-an500`,`0x40004000`),echo:_},{id:`mps2-an505`,name:`ARM MPS2 AN505 · Cortex-M33`,machine:`mps2-an505`,cpu:`cortex-m33`,flash:[`0x10000000`,`4M`],ram:[`0x38000000`,`2M`],wait:0,uart:l(`mps2-an505`,`0x50200000`),echo:_},{id:`mps2-an521`,name:`ARM MPS2 AN521 · Cortex-M33`,machine:`mps2-an521`,cpu:`cortex-m33`,flash:[`0x10000000`,`4M`],ram:[`0x38000000`,`2M`],wait:0,uart:l(`mps2-an521`,`0x50200000`),echo:_},{id:`mps3-an524`,name:`ARM MPS3 AN524 · Cortex-M33`,machine:`mps3-an524`,cpu:`cortex-m33`,flash:[`0x10000000`,`512K`],ram:[`0x30000000`,`128K`],wait:0,uart:l(`mps3-an524`,`0x51303000`),echo:_},{id:`mps3-an547`,name:`ARM MPS3 AN547 · Cortex-M55`,machine:`mps3-an547`,cpu:`cortex-m55`,flash:[`0x00000000`,`512K`],ram:[`0x20000000`,`512K`],wait:0,uart:l(`mps3-an547`,`0x49303000`),echo:_},{id:`musca-a`,name:`ARM Musca-A · Cortex-M33`,machine:`musca-a`,cpu:`cortex-m33`,flash:[`0x10200000`,`1M`],ram:[`0x30000000`,`128K`],wait:0,uart:c(`Musca-A`,`musca-a`,`0x50101000`),echo:g},{id:`musca-b1`,name:`ARM Musca-B1 · Cortex-M33`,machine:`musca-b1`,cpu:`cortex-m33`,flash:[`0x10000000`,`512K`],ram:[`0x30000000`,`128K`],wait:0,uart:c(`Musca-B1`,`musca-b1`,`0x50105000`),echo:g},{id:`microbit`,name:`BBC micro:bit (nRF51822) · Cortex-M0`,machine:`microbit`,cpu:`cortex-m0`,flash:[`0x00000000`,`256K`],ram:[`0x20000000`,`16K`],wait:0,uart:u,echo:re},{id:`stm32vldiscovery`,name:`STM32VLDISCOVERY (STM32F100) · Cortex-M3`,machine:`stm32vldiscovery`,cpu:`cortex-m3`,flash:[`0x08000000`,`128K`],ram:[`0x20000000`,`8K`],wait:1.5,uart:h(`STM32F100`,`stm32vldiscovery`,`0x40013800`),echo:S},{id:`netduino2`,name:`Netduino 2 (STM32F205) · Cortex-M3`,machine:`netduino2`,cpu:`cortex-m3`,flash:[`0x08000000`,`1024K`],ram:[`0x20000000`,`128K`],wait:1.5,uart:h(`STM32F205`,`netduino2`,`0x40011000`),echo:S},{id:`netduinoplus2`,name:`Netduino Plus 2 (STM32F405) · Cortex-M4`,machine:`netduinoplus2`,cpu:`cortex-m4`,flash:[`0x08000000`,`1024K`],ram:[`0x20000000`,`128K`],wait:1.5,uart:h(`STM32F405`,`netduinoplus2`,`0x40011000`),echo:S},{id:`stm32f4_discovery`,name:`STM32F4 Discovery (STM32F407) · Cortex-M4`,machine:`stm32f4_discovery`,renode:`usart2`,cpu:`cortex-m4`,flash:[`0x08000000`,`1024K`],ram:[`0x20000000`,`128K`],wait:1,uart:h(`STM32F407`,`stm32f4_discovery`,`0x40004400`,`USART2`,`Renode`),echo:S},{id:`stm32f072b_discovery`,name:`STM32F072 Discovery (STM32F072) · Cortex-M0`,machine:`stm32f072b_discovery`,renode:`usart1`,cpu:`cortex-m0`,flash:[`0x08000000`,`128K`],ram:[`0x20000000`,`16K`],wait:1,uart:m(`STM32F072`,`stm32f072b_discovery`,`0x40013800`,`USART1`),echo:b},{id:`nucleo_f767zi`,name:`Nucleo-F767ZI (STM32F767) · Cortex-M7`,machine:`nucleo_f767zi`,renode:`usart3`,cpu:`cortex-m7`,flash:[`0x08000000`,`2048K`],ram:[`0x20000000`,`512K`],wait:1,uart:m(`STM32F767`,`nucleo_f767zi`,`0x40004800`,`USART3`),echo:b},{id:`nucleo_wba52cg`,name:`Nucleo-WBA52CG (STM32WBA52) · Cortex-M33`,machine:`nucleo_wba52cg`,renode:`usart1`,cpu:`cortex-m33`,flash:[`0x08000000`,`1024K`],ram:[`0x20000000`,`128K`],wait:1,uart:m(`STM32WBA52`,`nucleo_wba52cg`,`0x40013800`,`USART1`),echo:b},{id:`renesas-ek_ra2e1`,name:`Renesas EK-RA2E1 (RA2E1) · Cortex-M23`,machine:`renesas-ek_ra2e1`,renode:`sci0`,cpu:`cortex-m23`,flash:[`0x00000000`,`128K`],ram:[`0x20004000`,`16K`],wait:0,uart:ne(`RA2E1`,`renesas-ek_ra2e1`,`0x40070000`),echo:x},{id:`renesas-ck_ra6m5`,name:`Renesas CK-RA6M5 (RA6M5) · Cortex-M33`,machine:`renesas-ck_ra6m5`,renode:`sci0`,cpu:`cortex-m33`,flash:[`0x00000000`,`2048K`],ram:[`0x20000000`,`512K`],wait:0,uart:ne(`RA6M5`,`renesas-ck_ra6m5`,`0x40118000`),echo:x},{id:`emcraft-sf2`,name:`Emcraft SmartFusion2 (M2S010) · Cortex-M3`,machine:`emcraft-sf2`,cpu:`cortex-m3`,flash:[`0x00000000`,`256K`],ram:[`0x20000000`,`64K`],wait:0,uart:d(`SmartFusion2 M2S010`,`emcraft-sf2`,`0x40000000`),echo:v},{id:`ast1030-evb`,name:`Aspeed AST1030 · Cortex-M4`,machine:`ast1030-evb`,cpu:`cortex-m4`,flash:[`0x00000000`,`512K`],ram:[`0x00080000`,`256K`],wait:0,uart:d(`AST1030`,`ast1030-evb`,`0x7E784000`),echo:v},{id:`arduino-uno`,name:`Arduino Uno (ATmega328P) · AVR`,arch:`avr`,machine:`arduino-uno`,cpu:`atmega328p`,wait:1.5,uart:f(`ATmega328P`,`arduino-uno`),echo:y},{id:`arduino-mega-2560-v3`,name:`Arduino Mega 2560 (ATmega2560) · AVR`,arch:`avr`,machine:`arduino-mega-2560-v3`,cpu:`atmega2560`,wait:1.5,uart:f(`ATmega2560`,`arduino-mega-2560-v3`),echo:y},{id:`sifive_e`,name:`SiFive HiFive1 (FE310) · RISC-V`,arch:`riscv`,machine:`sifive_e`,cpu:`rv32imac`,flash:[`0x20400000`,`12M`],ram:[`0x80000000`,`16K`],wait:0,uart:ee,echo:ie},{id:`opentitan`,name:`OpenTitan (Ibex) · RISC-V`,arch:`riscv`,machine:`opentitan`,cpu:`rv32im`,flash:[`0x20000400`,`1023K`],ram:[`0x10000000`,`128K`],wait:0,uart:te,echo:ae}],w=e=>C.find(t=>t.id===e)??C[0],oe=e=>new Set([...e.matchAll(/^#define\s+(\w+)/gm)].map(e=>e[1]));function se(e,t){let n=oe(t.uart),r=[...new Set(C.flatMap(e=>[...oe(e.uart)]))].filter(e=>!n.has(e)&&e!==`UART_H`),i=new Set,a=[];for(let[t,n]of Object.entries(e)){if(t!==`agent/PROMPT.md`&&!/^references\/.+\.c$/.test(t))continue;let e=r.filter(e=>RegExp(`\\b${e}\\b`).test(n));e.length&&a.push(t),e.forEach(e=>i.add(e))}return{names:[...i].sort(),files:a}}var ce=`/* avr-libc has already copied .data and zeroed .bss: call app_main. */
void app_main(void);

int main(void)
{
    app_main();
    for (;;) ;
}
`,le=`/* Reset: copy .data from flash, zero .bss, call app_main. */
#include <stdint.h>

extern uint32_t _etext, _sdata, _edata, _sbss, _ebss, _estack;
void app_main(void);

void reset(void)
{
    uint32_t *s = &_etext, *d = &_sdata;
    while (d < &_edata) *d++ = *s++;
    for (d = &_sbss; d < &_ebss;) *d++ = 0;
    app_main();
    for (;;) ;
}

__attribute__((section(".vectors"), used)) static void *vectors[] = { &_estack, reset };
`,ue=`/* Reset: set the stack, copy .data from flash, zero .bss, call app_main. */
#include <stdint.h>

extern uint32_t _etext, _sdata, _edata, _sbss, _ebss, _estack;
void app_main(void);

void init(void)
{
    uint32_t *s = &_etext, *d = &_sdata;
    while (d < &_edata) *d++ = *s++;
    for (d = &_sbss; d < &_ebss;) *d++ = 0;
    app_main();
    for (;;) ;
}

__attribute__((section(".vectors"), naked, used)) void reset(void)
{
    __asm__ volatile("la sp, _estack\\n j init");
}
`,de=e=>{let t=t=>e.arch===`riscv`?` *(.${t}*)`:``;return`/* ${e.machine}: flash at ${e.flash[0]}, RAM at ${e.ram[0]}. */
MEMORY {
  FLASH (rx)  : ORIGIN = ${e.flash[0]}, LENGTH = ${e.flash[1]}
  RAM   (rwx) : ORIGIN = ${e.ram[0]}, LENGTH = ${e.ram[1]}
}
ENTRY(reset)
SECTIONS {
  .text : { KEEP(*(.vectors)) *(.text*) *(.rodata*)${t(`srodata`)}${t(`eh_frame`)} *(.ARM.exidx*) . = ALIGN(4); _etext = .; } > FLASH
  .data : AT(_etext) { _sdata = .; *(.data*)${t(`sdata`)} . = ALIGN(4); _edata = .; } > RAM
  .bss  : { _sbss = .; *(.bss*)${t(`sbss`)} *(COMMON) . = ALIGN(4); _ebss = .; } > RAM
  _estack = ORIGIN(RAM) + LENGTH(RAM);
}
`},fe={arm:{gcc:`arm-none-eabi-gcc`,cc:`["arm-none-eabi-gcc", "-mcpu=" + CPU, "-mthumb", "-Os", "-ffreestanding",
         "-fno-tree-loop-distribute-patterns", "-nostdlib", "-I/tests", "-T", "/tests/link.ld",
         "/tests/start.c", source, "-lgcc", "-o", out]`,qemu:`qemu-system-arm`,load:`-kernel`,start:le,group:null,packages:`gcc-arm-none-eabi, libnewlib-arm-none-eabi, qemu-system-arm`},avr:{gcc:`avr-gcc`,cc:`["avr-gcc", "-mmcu=" + CPU, "-Os", "-I/tests", "/tests/start.c", source, "-o", out]`,qemu:`qemu-system-avr`,load:`-bios`,start:ce,group:`AVR`,packages:`gcc-avr, avr-libc, qemu-system-misc`},riscv:{gcc:`riscv64-unknown-elf-gcc`,cc:`["riscv64-unknown-elf-gcc", "-march=" + CPU, "-mabi=ilp32", "-Os", "-ffreestanding",
         "-fno-tree-loop-distribute-patterns", "-nostdlib", "-I/tests", "-T", "/tests/link.ld",
         "/tests/start.c", source, "-lgcc", "-o", out]`,qemu:`qemu-system-riscv32`,load:`-kernel`,start:ue,group:`RISC-V`,packages:`gcc-riscv64-unknown-elf, qemu-system-misc`}},T=e=>fe[e.arch??`arm`],pe=e=>T(e).group??e.cpu.replace(`cortex-m`,`Arm Cortex-M`),me=`RUN case "$(uname -m)" in x86_64) a= s=4ba7c68b59e2447f188ef4b4b112fcccd2802582c460beedceb63b84e5605a5f ;; aarch64) a=-arm64 s=e9051578411441bfb47b77de0381cfba3badce03663367fab561472fd7807f1f ;; *) echo "no Renode build for $(uname -m)" >&2; exit 1 ;; esac \\
    && curl -fsSL -o /tmp/renode.tar.gz "https://github.com/renode/renode/releases/download/v1.17.0/renode-1.17.0.linux$a-portable.tar.gz" \\
    && echo "$s  /tmp/renode.tar.gz" | sha256sum -c - \\
    && mkdir -p /opt/renode && tar -xzf /tmp/renode.tar.gz -C /opt/renode --strip-components=1 && rm /tmp/renode.tar.gz \\
    && ln -s /opt/renode/renode /usr/local/bin/renode`,he=e=>T(e).packages.split(`, `).filter(e=>!e.startsWith(`qemu-system`)),ge={QEMU:{noun:`machine`,check:e=>`${T(e).qemu} --version`,grader:e=>T(e).packages.split(`, `),box:e=>T(e).packages.split(`, `),install:[],files:e=>({}),runSh:e=>xe(e),imports:[`threading`],board:e=>Te(e)},Renode:{noun:`board`,check:e=>`renode --version`,grader:e=>[...he(e),`curl`,`ca-certificates`],box:e=>[...he(e),`curl`,`ca-certificates`,`socat`],install:[me],files:e=>({"board.resc":be(e)}),runSh:e=>Se(e),imports:[`socket`,`sys`,`tempfile`],board:e=>we}},E=e=>ge[s(e)],_e=e=>`${s(e)} ${E(e).noun} ${e.machine}`,ve=e=>[`${T(e).gcc} --version`,E(e).check(e)],D=e=>E(e).box(e).join(`, `),ye=e=>E(e).install,be=e=>`mach create
machine LoadPlatformDescription @platforms/boards/${e.machine}.repl
sysbus LoadELF $elf
emulation CreateServerSocketTerminal $port "uart" false
connector Connect sysbus.${e.renode} uart
start
`,xe=e=>`#!/bin/sh
# sh run.sh firmware.elf: the board, with its UART on stdin/stdout. mux=off so
# that a 0x01 byte on the wire is data and not a QEMU escape.
exec ${T(e).qemu} -M ${e.machine} -nographic -monitor none \\
    -chardev stdio,id=uart,mux=off,signal=off -serial chardev:uart ${T(e).load} "$1"
`,Se=e=>`#!/bin/sh
# sh run.sh firmware.elf: the board, with its UART on stdin/stdout. Renode puts
# the UART on a local socket; once the board is running, socat joins it to this
# terminal. Renode stops when this does, Ctrl-C included.
log=$(mktemp)
port=$((20000 + $$ % 20000))
renode --disable-gui -P -1 -e "\\$elf=@$(realpath "$1"); \\$port=$port; include @$(dirname "$0")/board.resc" >"$log" 2>&1 &
renode=$!
trap 'kill $renode 2>/dev/null; rm -f "$log"' EXIT
trap 'exit 130' INT TERM
tries=0
until grep -q "Machine started" "$log"; do
    tries=$((tries + 1))
    if ! kill -0 $renode 2>/dev/null || [ $tries -gt 1200 ]; then
        echo "renode did not start the board:" >&2; tail -c 2000 "$log" >&2; exit 1
    fi
    sleep 0.1
done
sleep ${e.wait}
exec 3<&0
socat -,ignoreeof TCP:127.0.0.1:$port <&3 &
wait $!
`,Ce=e=>`"""Build an image for ${e.machine}, and put bytes on its UART and collect what comes back."""
${[`os`,`select`,`subprocess`,`time`,...E(e).imports].sort().map(e=>`import ${e}`).join(`
`)}

MACHINE = "${e.machine}"
CPU = "${e.cpu}"
WAIT_S = ${e.wait}    # a UART that drops bytes until the firmware has turned it on


def build(source, out):
    """Compile source against the grader's own ${e.arch===`avr`?`start.c and uart.h`:`start.c, link.ld and uart.h`}."""
    return subprocess.run(
        ${T(e).cc},
        capture_output=True, text=True, timeout=180,
    )


${E(e).board(e)}`,we=`def _log(path):
    with open(path, "rb") as f:
        return f.read()


def board(elf, data, expected, settle=0.4, deadline=30, boot=120):
    """Feed data to the board and return what it sent, once it has been quiet for \`settle\` seconds.

    Renode may take up to \`boot\` seconds to start the board; \`deadline\` counts from then.
    """
    with socket.socket() as s:    # a port of this run's own for the UART
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
    fd, log = tempfile.mkstemp()
    p = subprocess.Popen(
        ["renode", "--disable-gui", "-P", "-1", "-e", f"$elf=@{os.path.abspath(elf)}; $port={port}; include @/tests/board.resc"],
        stdin=subprocess.DEVNULL, stdout=fd, stderr=subprocess.STDOUT,
    )
    os.close(fd)
    got = b""
    start = time.monotonic()
    try:
        # Renode logs this once the board is loaded, its UART connected and the firmware running
        while b"Machine started" not in _log(log):
            if p.poll() is not None or time.monotonic() - start > boot:
                print("renode did not start the board:\\n" + _log(log).decode(errors="replace")[-2000:], file=sys.stderr)
                return got
            time.sleep(0.1)
        start = time.monotonic()    # a slow start, on a small box, costs the exchange nothing
        with socket.create_connection(("127.0.0.1", port), timeout=5) as s:
            time.sleep(WAIT_S)
            s.sendall(data)
            s.setblocking(False)
            last = time.monotonic()
            while time.monotonic() - start < deadline:
                r, _, _ = select.select([s], [], [], 0.1)
                if r:
                    chunk = s.recv(4096)
                    if not chunk:
                        break
                    got += chunk
                    last = time.monotonic()
                elif len(got) >= expected and time.monotonic() - last >= settle:
                    break
    finally:
        p.kill()
        p.wait()
        os.unlink(log)
    return got
`,Te=e=>`def board(elf, data, expected, settle=0.4, deadline=30):
    """Feed data to the board and return what it sent, once it has been quiet for \`settle\` seconds."""
    p = subprocess.Popen(
        ["${T(e).qemu}", "-M", MACHINE, "-nographic", "-monitor", "none",
         "-chardev", "stdio,id=uart,mux=off,signal=off", "-serial", "chardev:uart",
         "${T(e).load}", elf],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
    )
    sent = threading.Event()

    def feed():
        time.sleep(WAIT_S)
        try:
            for k in range(0, len(data), 64):
                p.stdin.write(data[k:k + 64])
                p.stdin.flush()
        except (BrokenPipeError, OSError):
            pass
        sent.set()

    threading.Thread(target=feed, daemon=True).start()
    got = b""
    start = last = time.monotonic()
    fd = p.stdout.fileno()
    try:
        while time.monotonic() - start < deadline:
            r, _, _ = select.select([fd], [], [], 0.1)
            if r:
                chunk = os.read(fd, 4096)
                if not chunk:
                    break
                got += chunk
                last = time.monotonic()
            elif sent.is_set() and len(got) >= expected and time.monotonic() - last >= settle:
                break
            elif sent.is_set() and expected == 0 and time.monotonic() - last >= settle:
                break
    finally:
        p.kill()
        p.wait()
    return got
`;function Ee(e){let t={"start.c":T(e).start,...e.arch===`avr`?{}:{"link.ld":de(e),...E(e).files(e)},"uart.h":e.uart};return{...Object.fromEntries(Object.entries(t).flatMap(([e,t])=>[[`environment/data/${e}`,t],[`verifier/${e}`,t]])),"environment/data/run.sh":E(e).runSh(e),"verifier/board.py":Ce(e)}}var De=`import sys

from board import board

elf = sys.argv[1]
got = board(elf, b"abc", expected=3)

print(f"echo_ok={int(got == b'bcd')}")
print(f"bytes_back={len(got)}")
`,Oe=e=>{let t=T(e),n=E(e).grader(e).join(` `),r=t.packages.includes(`qemu-system-misc`)?` \\\n    && find /usr/bin -name 'qemu-system-*' ! -name ${t.qemu} -delete \\\n   `:``;return a(`# The withheld half, for a firmware task: the checks build firmware.c with
# ${t.gcc} and drive.py runs the image under ${s(e)}. Copies only verifier/.
FROM python:3.12-slim-bookworm@sha256:782412e85d0f0984994c290652577d4018aff08145c85b262bb63dc0c7522254

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends ${n}${r} && rm -rf /var/lib/apt/lists/*
${E(e).install.map(e=>e+`
`).join(``)}${i(`pytest==9.1.1 pytest-json-ctrf==0.5.2`)}

COPY verifier/ /tests/

RUN mkdir -p /app /out
`)},ke=`<?xml version="1.0" encoding="UTF-8"?>

<!-- generated on 2026-09-30 10:03:33 by Eclipse SUMO netconvert Version 1.15.0
<configuration xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://sumo.dlr.de/xsd/netconvertConfiguration.xsd">

    <input>
        <node-files value="net.nod.xml"/>
        <edge-files value="net.edg.xml"/>
    </input>

    <output>
        <output-file value="net.net.xml"/>
    </output>

</configuration>
-->

<net version="1.9" junctionCornerDetail="5" limitTurnSpeed="5.50" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://sumo.dlr.de/xsd/net_file.xsd">

    <location netOffset="0.00,0.00" convBoundary="0.00,0.00,500.00,0.00" origBoundary="0.00,0.00,500.00,0.00" projParameter="!"/>

    <edge id="AB" from="A" to="B" priority="-1">
        <lane id="AB_0" index="0" speed="13.90" length="500.00" shape="-0.00,-1.60 500.00,-1.60"/>
    </edge>

    <junction id="A" type="dead_end" x="0.00" y="0.00" incLanes="" intLanes="" shape="-0.00,0.00 -0.00,-3.20"/>
    <junction id="B" type="dead_end" x="500.00" y="0.00" incLanes="AB_0" intLanes="" shape="500.00,-3.20 500.00,0.00"/>

</net>
`,Ae=`<routes>
  <vType id="car" accel="2.6" decel="4.5" length="5" maxSpeed="13.9" sigma="0"/>
  <route id="r0" edges="AB"/>
  <vehicle id="v0" type="car" route="r0" depart="0"/>
</routes>
`,je=`<configuration>
  <input>
    <net-file value="net.net.xml"/>
    <route-files value="trips.rou.xml"/>
  </input>
  <time><begin value="0"/><end value="200"/></time>
</configuration>
`,O=`{
  "Vehicle": {
    "description": "High-level vehicle data.",
    "type": "branch",
    "uuid": "ccc825f94139544dbb5f4bfd033bece6",
    "children": {
      "Speed": {
        "datatype": "float",
        "description": "Vehicle speed.",
        "type": "sensor",
        "unit": "km/h",
        "uuid": "efe50798638d55fab18ab7d43cc490e9"
      },
      "OBD": {
        "description": "OBD data.",
        "type": "branch",
        "uuid": "7ad7c512ed5d52c8b31944d2d47a4bc3",
        "children": {
          "Speed": {
            "datatype": "float",
            "description": "PID 0D - Vehicle speed",
            "type": "sensor",
            "unit": "km/h",
            "uuid": "91ed0bb43eb054759813cd784b071764"
          }
        }
      },
      "CurrentLocation": {
        "description": "The current latitude and longitude of the vehicle.",
        "type": "branch",
        "uuid": "24777bd485f15fb69550ae0520c40ad5",
        "children": {
          "Latitude": {
            "datatype": "double",
            "description": "Current latitude of vehicle in WGS 84 geodetic coordinates, as measured at the position of GNSS receiver antenna.",
            "max": 90,
            "min": -90,
            "type": "sensor",
            "unit": "degrees",
            "uuid": "08933c5a445055df80bea15fbfa07f1c"
          },
          "Longitude": {
            "datatype": "double",
            "description": "Current longitude of vehicle in WGS 84 geodetic coordinates, as measured at the position of GNSS receiver antenna.",
            "max": 180,
            "min": -180,
            "type": "sensor",
            "unit": "degrees",
            "uuid": "5246f2ec5fea550cb1b36f110854cfbb"
          }
        }
      },
      "Powertrain": {
        "description": "Powertrain data for battery management, etc.",
        "type": "branch",
        "uuid": "12f35ec7bd1c58d1a329565ce3d053d5",
        "children": {
          "TractionBattery": {
            "description": "Battery Management data.",
            "type": "branch",
            "uuid": "1a2515d1a8875d86873431194ade2b50",
            "children": {
              "StateOfCharge": {
                "description": "Information on the state of charge of the vehicle's high voltage battery.",
                "type": "branch",
                "uuid": "26bae2ce7c4d5e2a951915ef2f5d8b7d",
                "children": {
                  "Current": {
                    "datatype": "float",
                    "description": "Physical state of charge of the high voltage battery, relative to net capacity. This is not necessarily the state of charge being displayed to the customer.",
                    "max": 100.0,
                    "min": 0,
                    "type": "sensor",
                    "unit": "percent",
                    "uuid": "2e647ca3a1ff5e52af137aab240642da"
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
`,k=`# Anonymous MQTT on the loopback only, as the grader runs it.
listener 1883 127.0.0.1
allow_anonymous true
`,Me=`from kuksa_client.grpc import Datapoint, VSSClient

# What /app/solution.py would be: connect to the databroker and set a signal.
with VSSClient("127.0.0.1", 55555) as client:
    client.set_current_values({"Vehicle.Speed": Datapoint(42.0)})`,Ne=`import subprocess
import sys

from kuksa_client.grpc import VSSClient

from stack import running

with running() as (host, port):
    subprocess.run(["python3", sys.argv[1]], timeout=60)
    with VSSClient(host, port) as client:
        speed = client.get_current_values(["Vehicle.Speed"])["Vehicle.Speed"]

print(f"speed_set={int(speed is not None and speed.value == 42.0)}")
`,Pe=`import json

import zenoh

# What /app/solution.py would be: connect to the router and publish a value.
conf = zenoh.Config()
conf.insert_json5("mode", '"client"')
conf.insert_json5("connect/endpoints", json.dumps(["tcp/127.0.0.1:7447"]))
conf.insert_json5("scouting/multicast/enabled", "false")
with zenoh.open(conf) as session:
    session.put("demo/greeting", "hello")`,Fe=`import json
import subprocess
import sys
import time

import zenoh

from stack import running

with running() as (host, port):
    conf = zenoh.Config()
    conf.insert_json5("mode", '"client"')
    conf.insert_json5("connect/endpoints", json.dumps([f"tcp/{host}:{port}"]))
    conf.insert_json5("scouting/multicast/enabled", "false")
    with zenoh.open(conf) as session:
        sub = session.declare_subscriber("demo/**")
        subprocess.run(["python3", sys.argv[1]], timeout=60)
        time.sleep(0.5)
        sample = sub.try_recv()

print(f"greeting_ok={int(sample is not None and sample.payload.to_string() == 'hello')}")
`,Ie=`import paho.mqtt.client as mqtt

# What /app/solution.py would be: connect to the broker and publish a message.
client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
client.connect("127.0.0.1", 1883)
client.publish("demo/greeting", "hello").wait_for_publish()
client.disconnect()`,Le=`import subprocess
import sys
import time

import paho.mqtt.client as mqtt

from stack import running

got = []

with running() as (host, port):
    sub = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    sub.on_message = lambda client, userdata, message: got.append(message.payload.decode())
    sub.connect(host, port)
    sub.subscribe("demo/greeting")
    sub.loop_start()
    time.sleep(0.5)
    subprocess.run(["python3", sys.argv[1]], timeout=60)
    time.sleep(0.5)
    sub.loop_stop()

print(f"greeting_ok={int(got == ['hello'])}")
`,Re=`import traci

# What /app/solution.py would be: start SUMO, step it 30 seconds, report the car's speed.
traci.start(["sumo", "-c", "/app/data/sim.sumocfg", "--no-step-log", "true"])
speed = None
for _ in range(30):
    traci.simulationStep()
    ids = traci.vehicle.getIDList()
    if ids:
        speed = traci.vehicle.getSpeed(ids[0])
traci.close()
print(f"speed={speed:.2f}")`,ze=`import re
import subprocess
import sys

done = subprocess.run(["python3", sys.argv[1]], capture_output=True, text=True, timeout=120)
found = re.search(r"speed=([0-9.]+)", done.stdout)
speed = float(found.group(1)) if found else -1.0

print(f"speed_ok={int(abs(speed - 13.9) < 0.05)}")
`,Be=`from velocitas_sdk.model import DataPointFloat, Model


# What the Velocitas vehicle-model generator writes from a VSS catalogue, cut to one signal.
class Vehicle(Model):
    def __init__(self, name):
        super().__init__()
        self.name = name
        self.Speed = DataPointFloat("Speed", self)


vehicle = Vehicle("Vehicle")
`,Ve=`import asyncio
import json
import sys

sys.path.insert(0, "/app/data")      # vehicle.py, the vehicle model, is there

from vehicle import vehicle
from velocitas_sdk.vdb.reply import DataPointReply
from velocitas_sdk.vehicle_app import VehicleApp, subscribe_data_points


# What /app/solution.py would be: relay every change of Vehicle.Speed to MQTT.
class SpeedApp(VehicleApp):
    def __init__(self, vehicle_client):
        super().__init__()
        self.Vehicle = vehicle_client

    @subscribe_data_points("Vehicle.Speed")
    async def on_speed(self, data: DataPointReply):
        speed = data.get(self.Vehicle.Speed).value
        await self.publish_event("demo/speed", json.dumps({"speed": speed}))


async def main():
    await SpeedApp(vehicle).run()


asyncio.run(main())`,He=`import json
import subprocess
import sys
import time

import paho.mqtt.client as mqtt

from stack import PORTS, feed, running

got = []

with running():
    sub = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    sub.on_message = lambda client, userdata, message: got.append(json.loads(message.payload))
    sub.connect("127.0.0.1", PORTS["mosquitto"])
    sub.subscribe("demo/speed")
    sub.loop_start()
    app = subprocess.Popen(["python3", sys.argv[1]], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(4)                       # the app is connected and subscribed by now
    feed("Vehicle.Speed", 42.0)
    time.sleep(2)
    app.terminate()
    app.wait(10)
    sub.loop_stop()

print(f"speed_relayed={int(any(m.get('speed') == 42.0 for m in got))}")
`,Ue=`def feed(path, value, host="127.0.0.1", port=55555):
    """Set a float sensor's current value in the databroker, as a feeder would."""
    import grpc
    from velocitas_sdk.proto.broker_pb2 import GetMetadataRequest
    from velocitas_sdk.proto.broker_pb2_grpc import BrokerStub
    from velocitas_sdk.proto.collector_pb2 import UpdateDatapointsRequest
    from velocitas_sdk.proto.collector_pb2_grpc import CollectorStub
    from velocitas_sdk.proto.types_pb2 import Datapoint

    with grpc.insecure_channel(f"{host}:{port}") as channel:
        meta = BrokerStub(channel).GetMetadata(GetMetadataRequest(names=[path])).list[0]
        CollectorStub(channel).UpdateDatapoints(
            UpdateDatapointsRequest(datapoints={meta.id: Datapoint(float_value=value)}))
`,We=`module solution {
  // What /app/solution.ttcn would be: the function the grader's tests call.
  function f_checksum(in octetstring d) return integer {
    var integer s := 0;
    for (var integer i := 0; i < lengthof(d); i := i + 1) {
      s := s + oct2int(substr(d, i, 1));
    }
    return s mod 256;
  }
}`,Ge=`module grade {
  import from solution all;
  type component C {}
  testcase tc_empty() runs on C {
    if (f_checksum(''O) == 0) { setverdict(pass) } else { setverdict(fail) }
  }
  testcase tc_small() runs on C {
    if (f_checksum('010203'O) == 6) { setverdict(pass) } else { setverdict(fail) }
  }
  testcase tc_wraps() runs on C {
    if (f_checksum('FFFF'O) == 254) { setverdict(pass) } else { setverdict(fail) }
  }
  control { execute(tc_empty()); execute(tc_small()); execute(tc_wraps()); }
}
`,Ke=`import sys

from stack import run_ttcn

for name, passed in run_ttcn(sys.argv[1], "/tests/grade.ttcn").items():
    print(f"{name}={int(passed)}")
`,qe=`#!/bin/sh
# sh /app/data/ttcn.sh test.ttcn solution.ttcn ...: build the modules with TITAN and run the control part of the first one.
set -e
work=$(mktemp -d)
for f in "$@"; do cp "$f" "$work"/; done
cd "$work"
first=$(basename "$1" .ttcn)
unset TTCN3_DIR
ttcn3_makefilegen -s -f $(for f in "$@"; do basename "$f"; done) >/dev/null
make >build.log 2>&1 || { cat build.log; exit 1; }
printf '[LOGGING]\\nConsoleMask := TTCN_TESTCASE | TTCN_VERDICTOP\\n[EXECUTE]\\n%s\\n' "$first" > "$first.cfg"
"./$first" "$first.cfg"
`,Je=`def _env():
    """The generated Makefile finds Debian's layout itself, but only while TTCN3_DIR is unset."""
    env = dict(os.environ)
    env.pop("TTCN3_DIR", None)
    return env


def run_ttcn(solution, grader, timeout=180):
    """Build the grader's module (named grade) with the agent's (named solution), run it, return {test case: passed}."""
    work = tempfile.mkdtemp()
    shutil.copy(solution, os.path.join(work, "solution.ttcn"))
    shutil.copy(grader, os.path.join(work, "grade.ttcn"))
    env = _env()
    for cmd in (["ttcn3_makefilegen", "-s", "-f", "grade.ttcn", "solution.ttcn"], ["make"]):
        done = subprocess.run(cmd, cwd=work, capture_output=True, text=True, env=env, timeout=timeout)
        if done.returncode != 0:
            sys.stderr.write((done.stdout + done.stderr)[-2000:])
            return {}
    with open(os.path.join(work, "grade.cfg"), "w") as f:
        f.write("[LOGGING]\\nConsoleMask := TTCN_TESTCASE\\n[EXECUTE]\\ngrade\\n")
    run = subprocess.run(["./grade", "grade.cfg"], cwd=work, capture_output=True, text=True, env=env, timeout=timeout)
    return {m.group(1): m.group(2) == "pass" for m in re.finditer(r"Test case (\\w+) finished\\. Verdict: (\\w+)", run.stdout + run.stderr)}
`,Ye=`def build(source, out):
    """The agent's module must compile on its own; it is then copied to out for the driver."""
    work = tempfile.mkdtemp()
    shutil.copy(source, os.path.join(work, "solution.ttcn"))
    checked = subprocess.run(["ttcn3_compiler", "solution.ttcn"], cwd=work, capture_output=True, text=True, env=_env())
    if checked.returncode == 0:
        shutil.copy(source, out)
    return checked
`,Xe=`# What /app/solution.py would be: the program your component's user writes.
# Edit verifier/stack.py to start your component, and verifier/Dockerfile to install it.
print("hello")`,Ze=`import subprocess
import sys

from stack import running

with running() as (host, port):
    done = subprocess.run(["python3", sys.argv[1]], capture_output=True, text=True, timeout=60)

print(f"exit_ok={int(done.returncode == 0)}")
`,A=(e,t,n)=>`RUN case "$(uname -m)" in x86_64) a=amd64 s=${t} ;; aarch64) a=arm64 s=${n} ;; *) echo "no databroker build for $(uname -m)" >&2; exit 1 ;; esac \\
    && curl -fsSL -o /tmp/databroker.tar.gz "https://github.com/eclipse-kuksa/kuksa-databroker/releases/download/${e}/databroker-$a-${e}.tar.gz" \\
    && echo "$s  /tmp/databroker.tar.gz" | sha256sum -c - \\
    && tar -xzf /tmp/databroker.tar.gz -C /opt && rm /tmp/databroker.tar.gz \\
    && test -x /opt/databroker`,Qe=A(`0.7.1`,`bfad889720a21e2823542e66a3bfab7140dcadcf8a760600507c3e762ca68b92`,`2047a902f111fa309793a1b1b3a2d06c002282a5f3fe083adf5cdc5977e294c7`),$e=`RUN case "$(uname -m)" in x86_64) a=x86_64 s=512ac81438fd995ca2db02f75dd83afa048b6a11630ee10e0cb4dc423c39a5e9 ;; aarch64) a=aarch64 s=4d050013368b630ce102128168e50a22027b96fa8710cfd2379ededa578a384d ;; *) echo "no zenohd build for $(uname -m)" >&2; exit 1 ;; esac \\
    && curl -fsSL -o /tmp/zenoh.zip "https://github.com/eclipse-zenoh/zenoh/releases/download/1.10.1/zenoh-1.10.1-$a-unknown-linux-gnu-standalone.zip" \\
    && echo "$s  /tmp/zenoh.zip" | sha256sum -c - \\
    && unzip -q /tmp/zenoh.zip -d /tmp/zenoh \\
    && install -m 755 /tmp/zenoh/zenohd /opt/zenohd \\
    && rm -rf /tmp/zenoh /tmp/zenoh.zip \\
    && /opt/zenohd --version`,et=A(`0.5.0`,`46db28a570f0785ca96cd4f9f322f7d6f8cdd1f6a6741593be4a43a58d5e0091`,`03d2fe052b85247e44a196c8a32e4a02f57c0a276f1cd30a2c0b6ab664e7ae9a`),j=[{id:`kuksa`,name:`Eclipse Kuksa databroker 0.7.1 (vehicle signals over gRPC)`,apt:[`curl`,`ca-certificates`],install:[Qe],pip:[`kuksa-client==0.6.0`],host:`127.0.0.1`,services:[{name:`databroker`,port:55555,command:e=>[`/opt/databroker`,`--address`,`127.0.0.1`,`--port`,`55555`,`--insecure`,`--vss`,`${e}/vss.json`]}],config:{"vss.json":O},example:Me,driver:Ne},{id:`zenoh`,name:`Eclipse Zenoh 1.10.1 (pub/sub and queries)`,apt:[`curl`,`ca-certificates`,`unzip`],install:[$e],pip:[`eclipse-zenoh==1.10.1`],host:`127.0.0.1`,services:[{name:`zenohd`,port:7447,command:()=>[`/opt/zenohd`,`--listen`,`tcp/127.0.0.1:7447`,`--no-multicast-scouting`]}],config:{},example:Pe,driver:Fe},{id:`mosquitto`,name:`Eclipse Mosquitto 2.0 (MQTT broker, from Debian)`,apt:[`mosquitto`],install:[],pip:[`paho-mqtt==2.1.0`],host:`127.0.0.1`,services:[{name:`mosquitto`,port:1883,command:e=>[`mosquitto`,`-c`,`${e}/mosquitto.conf`]}],config:{"mosquitto.conf":k},example:Ie,driver:Le},{id:`sumo`,name:`Eclipse SUMO 1.15 (traffic simulation, driven with TraCI)`,apt:[`sumo`],install:[],pip:[`traci==1.15.0`],host:`127.0.0.1`,services:[],config:{"net.net.xml":ke,"trips.rou.xml":Ae,"sim.sumocfg":je},example:Re,driver:ze},{id:`velocitas`,name:`Eclipse Velocitas SDK 0.15 (vehicle apps, on Kuksa 0.5 and Mosquitto)`,apt:[`curl`,`ca-certificates`,`mosquitto`],install:[et],pip:[`velocitas-sdk==0.15.7`],host:`127.0.0.1`,services:[{name:`databroker`,port:55555,command:e=>[`/opt/databroker`,`--address`,`127.0.0.1`,`--port`,`55555`,`--insecure`,`--enable-databroker-v1`,`--vss`,`${e}/vss.json`]},{name:`mosquitto`,port:1883,command:e=>[`mosquitto`,`-c`,`${e}/mosquitto.conf`]}],config:{"vss.json":O,"mosquitto.conf":k,"vehicle.py":Be},helper:Ue,example:Ve,driver:He},{id:`titan`,name:`Eclipse TITAN 8.2 (TTCN-3 test toolset)`,apt:[`eclipse-titan`,`g++`],install:[],pip:[],host:`127.0.0.1`,services:[],config:{},example:We,driver:Ge,artifact:`/app/solution.ttcn`,answer:`ttcn`,harness:`verifier/grade.ttcn`,build:Ye,helper:Je,imports:[`os`,`re`,`shutil`,`sys`,`tempfile`],agentFiles:{"ttcn.sh":qe},verifierFiles:{"drive.py":Ke},note:`Eclipse TITAN 8.2, the TTCN-3 test toolset. The driver is given: it builds your grade.ttcn together with the solution.ttcn the model writes, runs it, and prints one line per test case, 1 for pass and 0 for anything else. The two modules must be named grade and solution, and grade imports from solution.`},{id:`custom`,name:`Another component (you set it up)`,apt:[],install:[],pip:[],host:`127.0.0.1`,services:[{name:`component`,port:8080,command:()=>[`/opt/your-component`]}],config:{},example:Xe,driver:Ze}];function tt(e){if(e.note)return e.note;if(!e.services.length)return`${e.name}: a tool the program starts itself, so running() starts nothing.`;let t=e.services.map(e=>`${e.name} on port ${e.port}`).join(`, `);return`${e.name}. running() starts ${t}.`+(e.services.length>1?` It gives you the first one's port; PORTS has each by name.`:``)}var M=e=>j.find(t=>t.id===e)??j[0],N=e=>[...e.apt,...e.pip.map(e=>`pip:${e}`)].join(`, `),nt=e=>`#!/bin/sh
# Start ${e.id} detached and return once everything it needs is accepting
# connections on ${e.host}.
#
# Each runs in its own session (\`setsid\`) or it is torn down when the tool
# call that started it returns -- a bare \`&\` or \`nohup &\` does not survive on
# the cloud substrate. stdin/stdout/stderr are redirected as well so the call
# does not block waiting for the pipe to close.
#
# Usage: sh /app/data/start.sh
set -e

up() {
    python3 - "$1" <<'PY' 2>/dev/null
import socket, sys
s = socket.socket()
s.settimeout(0.5)
sys.exit(0 if s.connect_ex(("${e.host}", int(sys.argv[1]))) == 0 else 1)
PY
}

# start NAME PORT COMMAND...
start() {
    name=$1
    port=$2
    shift 2
    if up "$port"; then
        echo "$name already answering on ${e.host}:$port"
        return 0
    fi
    setsid "$@" </dev/null >"/tmp/$name.log" 2>&1 &
    i=0
    while [ "$i" -lt 40 ]; do
        if up "$port"; then
            echo "$name ready on ${e.host}:$port (log: /tmp/$name.log)"
            return 0
        fi
        i=$((i + 1))
        sleep 0.5
    done
    echo "$name did not open ${e.host}:$port within 20s; tail of /tmp/$name.log:" >&2
    tail -n 20 "/tmp/$name.log" >&2 2>/dev/null || true
    exit 1
}

${e.services.map(e=>`start ${e.name} ${e.port} ${e.command(`/app/data`).join(` `)}`).join(`
`)}
`,P=`def build(source, out):
    """The agent's file must compile; it is then copied to out for the driver to run."""
    checked = subprocess.run(
        ["python3", "-c", "import sys; compile(open(sys.argv[1]).read(), sys.argv[1], 'exec')", source],
        capture_output=True, text=True,
    )
    if checked.returncode == 0:
        subprocess.run(["cp", source, out], check=True)
    return checked
`,F=(e,...t)=>[...new Set([...t,...e.imports??[]])].sort().map(e=>`import ${e}`).join(`
`),rt=e=>e.services.length?`"""Start ${e.id} for a run, and check that the agent's program is a program."""
${F(e,`contextlib`,`socket`,`subprocess`,`time`)}

HOST = "${e.host}"
# name, port, command: started in this order, stopped in reverse
SERVICES = [
${e.services.map(e=>`    (${JSON.stringify(e.name)}, ${e.port}, [${e.command(`/tests`).map(e=>JSON.stringify(e)).join(`, `)}]),`).join(`
`)}
]
PORTS = {name: port for name, port, _ in SERVICES}    # every service's port, by name


${e.build??P}
${e.helper?`
`+e.helper:``}
@contextlib.contextmanager
def running(timeout=20.0):
    """Start every service, wait until each accepts connections, yield (host, port), stop them.

    port is the first service's. A component with several services has each one's in PORTS.
    """
    processes = []
    try:
        for name, port, command in SERVICES:
            processes.append(subprocess.Popen(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
            end = time.monotonic() + timeout
            while time.monotonic() < end:
                with socket.socket() as s:
                    s.settimeout(0.5)
                    if s.connect_ex((HOST, port)) == 0:
                        break
                time.sleep(0.2)
            else:
                raise RuntimeError(f"{name} did not open {HOST}:{port} within {timeout}s")
        yield HOST, SERVICES[0][1]
    finally:
        for process in reversed(processes):
            process.terminate()
        for process in reversed(processes):
            try:
                process.wait(5)
            except subprocess.TimeoutExpired:
                process.kill()
`:`"""Check that the agent's program is a program. ${e.name} is a tool it starts itself, so there is nothing to start."""
${F(e,`contextlib`,`subprocess`)}

PORTS = {}

${e.build??P}
${e.helper?e.helper+`

`:``}@contextlib.contextmanager
def running():
    """Nothing to start or stop; yields (None, None) so a driver reads the same for a tool as for a service."""
    yield None, None
`,it=(e,t)=>[`# The withheld half: its own copy of the component and its configuration.`,`# Copies only verifier/, so the ticket and the references are not in this image.`,`FROM ${t}`,``,`ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1`,``,...e.apt.length?[`RUN apt-get update && apt-get install -y --no-install-recommends ${e.apt.join(` `)} && rm -rf /var/lib/apt/lists/*`]:[],...e.install,`RUN pip install --no-cache-dir ${[...e.pip,`pytest==9.1.1`,`pytest-json-ctrf==0.5.2`].join(` `)}`,``,`COPY verifier/ /tests/`,``,`RUN mkdir -p /app /out && ln -s /tests /app/data`].join(`
`)+`
`;function at(e,t){let n={"verifier/stack.py":rt(e),"verifier/Dockerfile":it(e,t)};e.services.length&&(n[`environment/data/start.sh`]=nt(e));for(let[t,r]of Object.entries(e.agentFiles??{}))n[`environment/data/${t}`]=r;for(let[t,r]of Object.entries(e.verifierFiles??{}))n[`verifier/${t}`]=r;for(let[t,r]of Object.entries(e.config))n[`environment/data/${t}`]=r,n[`verifier/${t}`]=r;return n}var I=({id:e,name:t,apt:n,install:r,pip:i},a,o={})=>({id:e,name:t,apt:n,install:r,pip:i,check:a,...o}),L=[I(M(`kuksa`),`/opt/databroker --version`,{installs:[`/opt/databroker`]}),I(M(`zenoh`),`/opt/zenohd --version`,{installs:[`/opt/zenohd`]}),I(M(`mosquitto`),`mosquitto -h | head -1`),I(M(`sumo`),`sumo --version | head -1`),I(M(`titan`),`ttcn3_compiler -v 2>&1 | head -1`),I(M(`velocitas`),`python3 -c "import velocitas_sdk; print(velocitas_sdk.__name__)"`,{needs:[`mosquitto`],installs:[`/opt/databroker`]}),{id:`arm`,name:`Arm GCC and QEMU (Cortex-M firmware)`,apt:[`gcc-arm-none-eabi`,`libnewlib-arm-none-eabi`,`qemu-system-arm`],install:[],pip:[],check:`arm-none-eabi-gcc --version | head -1; qemu-system-arm --version | head -1`}],R=e=>L.find(t=>t.id===e),z=e=>R(e)?.name.split(` (`)[0]??e;function B(e,t=new Set){if(t.has(e))return t;t.add(e);for(let n of R(e)?.needs??[])B(n,t);return t}function ot(e,t){if(e.includes(t)){let n=e.find(e=>e!==t&&B(e).has(t));return n?`${z(n)} needs it`:``}for(let n of B(t))for(let t of e)for(let e of R(n)?.installs??[])if(n!==t&&R(t)?.installs?.includes(e))return`${z(t)} already installs ${e}`;return``}var st=(e,t)=>e.includes(t)?e.filter(e=>e!==t):[...new Set([...e,...B(t)])],ct=`"""The camera rig and the look of a render, shared by the photos, render.py and the grader.

Edit the framing to fit your object: TARGET is the point the cameras look at, DISTANCE how far
away they stand. PHOTOS are the views the agent gets a photo of; every other view is one the
grader checks and the agent never sees.
"""
import math

import bpy
import numpy as np
from mathutils import Vector

# (azimuth, elevation) in degrees
VIEWS = [(35, 20), (125, 15), (215, 25), (305, 15), (0, 80)]
PHOTOS = [0, 3]
DISTANCE = 2.2
TARGET = Vector((0, 0, 0.45))
LENS = 50


def set_camera(view):
    scene = bpy.context.scene
    cam = bpy.data.objects.get("TaskCamera")
    if cam is None:
        cam = bpy.data.objects.new("TaskCamera", bpy.data.cameras.new("TaskCamera"))
        scene.collection.objects.link(cam)
    cam.data.lens = LENS
    az, el = map(math.radians, VIEWS[view])
    offset = Vector((math.cos(el) * math.cos(az), math.cos(el) * math.sin(az), math.sin(el)))
    cam.location = TARGET + DISTANCE * offset
    cam.rotation_mode = "QUATERNION"
    cam.rotation_quaternion = (TARGET - cam.location).to_track_quat("-Z", "Y")
    scene.camera = cam


def setup_render(res, mask):
    scene = bpy.context.scene
    if scene.world is None:
        scene.world = bpy.data.worlds.new("World")
    scene.world.color = (0.9, 0.9, 0.9)
    r = scene.render
    r.engine = "BLENDER_WORKBENCH"
    r.resolution_x = r.resolution_y = res
    r.resolution_percentage = 100
    r.film_transparent = mask
    r.image_settings.file_format = "PNG"
    r.image_settings.color_mode = "RGBA"
    shading = scene.display.shading
    shading.light = "STUDIO"
    shading.color_type = "SINGLE"
    shading.single_color = (0.55, 0.55, 0.6)
    shading.show_cavity = True


def render(path):
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def load_mask(path):
    img = bpy.data.images.load(path)
    w, h = img.size
    px = np.empty(w * h * 4, np.float32)
    img.pixels.foreach_get(px)
    bpy.data.images.remove(img)
    return px.reshape(h, w, 4)[..., 3] > 0.5


def triangles():
    """World-space triangles of every renderable mesh, modifiers and instances included."""
    dg = bpy.context.evaluated_depsgraph_get()
    tris = []
    for inst in dg.object_instances:
        ob = inst.object
        if ob.type != "MESH" or ob.original.hide_render:
            continue
        me = ob.to_mesh()
        me.calc_loop_triangles()
        v = np.empty(len(me.vertices) * 3)
        me.vertices.foreach_get("co", v)
        m = np.array(inst.matrix_world)
        v = v.reshape(-1, 3) @ m[:3, :3].T + m[:3, 3]
        t = np.empty(len(me.loop_triangles) * 3, np.int64)
        me.loop_triangles.foreach_get("vertices", t)
        tris.append(v[t.reshape(-1, 3)])
        ob.to_mesh_clear()
    return np.concatenate(tris) if tris else np.zeros((0, 3, 3))


def surface_points(tris, n=3000, seed=0):
    area = np.linalg.norm(np.cross(tris[:, 1] - tris[:, 0], tris[:, 2] - tris[:, 0]), axis=1) / 2
    if len(tris) == 0 or area.sum() == 0:
        return np.zeros((0, 3))
    rng = np.random.default_rng(seed)
    idx = rng.choice(len(tris), n, p=area / area.sum())
    s, r = np.sqrt(rng.random(n)), rng.random(n)
    t = tris[idx]
    return (1 - s)[:, None] * t[:, 0] + (s * (1 - r))[:, None] * t[:, 1] + (s * r)[:, None] * t[:, 2]


def pose(angles):
    """Turn each named object about its own X axis by that many degrees: a hinge at its origin.

    Children turn with their parent. A name with no object turns nothing. Returns what undo needs.
    """
    from mathutils import Matrix
    before = {}
    for name, deg in angles.items():
        ob = bpy.data.objects.get(name)
        if ob is None:
            continue
        before[name] = ob.matrix_basis.copy()
        ob.matrix_basis = ob.matrix_basis @ Matrix.Rotation(math.radians(deg), 4, "X")
    bpy.context.view_layer.update()
    return before


def unpose(before):
    for name, m in before.items():
        bpy.data.objects[name].matrix_basis = m
    bpy.context.view_layer.update()
`,lt=`"""Grade a submitted model against the hidden ground truth truth.py wrote from your gold.py.

blender -b model.blend -P grade.py -- <hidden_dir>

Silhouettes from the photos' cameras and from the cameras the agent never saw, surface distance
part by part, and, when poses.json names any, the silhouettes again with the joints bent: a model
that only looks right at rest, with no real hinges, fails those.
"""
import json
import os
import sys
import tempfile

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

hidden = os.path.abspath(sys.argv[sys.argv.index("--") + 1])
# Blender runs this only once the model's file has loaded: from here on, dying with no GRADE and no
# traceback is the grader's failure, not the model's (report.py). Flushed, as a crash drops what is not.
print("GRADING", flush=True)
here = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, here)
import common
import parts
import structure

MAX_TRIS = 50_000
MASK_RES = 512
POINTS = 20_000
PART_POINTS = 2_000
# Shares of the object's size. A point closer than CHAMFER_FREE costs nothing: a part modelled a few
# mm thicker is a fair answer, and the distance itself is float32, a few hundredths of a mm off on a
# long thin triangle. A part scores 0 when its points miss that band by CHAMFER_ZERO on average.
CHAMFER_FREE = 0.01
CHAMFER_ZERO = 0.02
# Shares of the part's own thickness, so a rod drawn twice as thick is wrong however small the rod. Thickness
# moves a surface by half the difference: up to THICK_FREE of the thickness off (20% thicker or thinner) is
# free; THICK_ZERO beyond that (twice as thick) costs half the part, as the part is still there and in place.
THICK_FREE = 0.1
THICK_ZERO = 0.4
OUTLINE_PX = 4  # an outline pixel this close to the other outline still matches: about 1% of the frame


def bvh(tris):
    verts = tris.reshape(-1, 3)
    return BVHTree.FromPolygons(verts.tolist(), np.arange(len(verts)).reshape(-1, 3).tolist(), all_triangles=True)


def nearest(tree, pts):
    """Distance to the nearest surface and the index of the triangle it lies on."""
    hits = [tree.find_nearest(p) for p in pts]
    return np.array([h[3] for h in hits]), np.array([h[2] for h in hits])


def outward(tris):
    """The triangles with each piece wound so its normals point out of it: a negative-scale object comes in inside out."""
    part_of = parts.islands(tris)
    vol = np.einsum("ij,ij->i", tris[:, 0], np.cross(tris[:, 1], tris[:, 2]))
    flip = np.bincount(part_of, vol)[part_of] < 0
    out = tris.copy()
    out[flip] = tris[flip][:, [0, 2, 1]]
    return out


def flush_faces(tree, tris, eps):
    """The faces another face lies flush against, both of each pair: where a probe has to look past the face it hit."""
    out = set()
    for i, c in enumerate(tris.mean(1)):
        near = [j for _, _, j, _ in tree.find_nearest_range(c, eps) if j != i]
        if near:
            out.add(i)
            out.update(near)
    return out


# Unit steps to the 26 neighbours of a cube cell: the ways out of a cavity tried
AROUND = [Vector((x, y, z)).normalized() for x in (-1, 0, 1) for y in (-1, 0, 1) for z in (-1, 0, 1) if x or y or z]


def enclosed(tree, p):
    """Whether p lies in a cavity closed on every side, the floor one of them: no ray out of it gets clear."""
    return all(tree.ray_cast(p, d)[0] is not None or d.z < 0 for d in AROUND)


def through(tree, piece, flush, p, d, cap, eps, floor):
    """How far the solid entered at p runs along d, at most cap and never below the floor: overlapping pieces count as
    one, by the faces' normals, and a cavity closed on every side counts as solid, as no camera can tell the two apart.

    At each hit every piece with a face through it counts once each way: where two pieces, or two faces of one,
    meet flush one is left as the other is entered, which changes nothing, and two triangles of one face are
    one crossing. eps is a share of the object's size, so a model in millimetres is probed as one in metres."""
    if d.z < 0:
        cap = min(cap, (p.z - floor) / -d.z)
    depth, s = 1, 0.0
    while True:
        loc, nrm, i, dist = tree.ray_cast(p + d * (s + eps), d, cap - s)
        if loc is None:
            return cap
        s += dist + eps
        sides = {(piece[i], 1 if nrm.dot(d) < 0 else -1)}
        for _, n, j, _ in (tree.find_nearest_range(loc, eps) if i in flush else ()):
            if abs(n.dot(d)) > 1e-3:
                sides.add((piece[j], 1 if n.dot(d) < 0 else -1))
        depth += sum(side for _, side in sides)
        if depth <= 0:
            if not enclosed(tree, p + d * (s + 1000 * eps)):   # clear of the face just left, as a ray is float32
                return s
            depth = 0


def thickness_error(gt_tree, model_tree, part_of, model_of, gt_flush, model_flush, k, pts, diag, floor):
    """How far part k's thickness is off: the real one straight in from each point, the model's straight in from
    its nearest surface, where that surface is closest to this part (a missing part is the distances' to judge).
    The median, so the odd probe through a joint or along an edge does not count, beyond THICK_FREE."""
    off = []
    for p in pts:
        _, n, _, _ = gt_tree.find_nearest(p)
        t = through(gt_tree, part_of, gt_flush, Vector(p), -n, diag, 1e-6 * diag, floor)
        q, m, _, _ = model_tree.find_nearest(p)
        if part_of[gt_tree.find_nearest(q)[2]] == k:
            off.append(abs(through(model_tree, model_of, model_flush, q, -m, 3 * t, 1e-6 * diag, floor) - t) / (2 * t))
    return max(float(np.median(off)) - THICK_FREE, 0.0) if off else 0.0


def camera_positions():
    out = []
    for v in range(len(common.VIEWS)):
        common.set_camera(v)
        out.append(bpy.context.scene.camera.location.copy())
    return out


def seen(tree, pts, cams):
    """Which points some camera has a clear line of sight to. Surface no camera ever sees
    (the inside of a shoe, a tube end buried in a seat) is not graded, for the real object or the model."""
    out = np.zeros(len(pts), bool)
    for i, p in enumerate(pts):
        for c in cams:
            d = Vector(p) - c
            if tree.ray_cast(c, d.normalized(), d.length - 1e-4)[0] is None:
                out[i] = True
                break
    return out


def part_scores(tris, gt_tris, diag):
    """Every part of the real object is scored on its own, so a hook counts as much as the pole.

    A part's error averages two distances: from the part to the model (is it there?) and from the
    model material closest to this part back to it (is what's there right?). Each is how far its
    points lie beyond CHAMFER_FREE, uncapped, so a small patch that is far off still counts. Its
    thickness, against its own, scales what that leaves.
    """
    part_of, model_of = parts.islands(gt_tris), parts.islands(tris)
    cams, gt_tree, model_tree = camera_positions(), bvh(gt_tris), bvh(outward(tris))
    gt_flush, model_flush = flush_faces(gt_tree, gt_tris, 1e-6 * diag), flush_faces(model_tree, tris, 1e-6 * diag)
    floor = float(gt_tris[..., 2].min())
    model_pts = common.surface_points(tris, POINTS, seed=11)
    model_pts = model_pts[seen(model_tree, model_pts, cams)]
    model_d, hit = nearest(gt_tree, model_pts)
    model_part = part_of[hit]
    scores, errors = [], []
    for k in range(part_of.max() + 1):
        pts = common.surface_points(gt_tris[part_of == k], PART_POINTS, seed=12 + k)
        pts = pts[seen(gt_tree, pts, cams)]
        if len(pts) == 0:
            continue                      # a part no camera can see is not graded at all
        missing, _ = nearest(model_tree, pts)
        near = model_d[model_part == k]
        missing, near = np.maximum(missing / diag - CHAMFER_FREE, 0), np.maximum(near / diag - CHAMFER_FREE, 0)
        err = (missing.mean() + (near.mean() if len(near) else missing.mean())) / 2
        errors.append(float(err))
        thick = thickness_error(gt_tree, model_tree, part_of, model_of, gt_flush, model_flush, k, pts, diag, floor)
        scores.append(max(0.0, 1 - err / CHAMFER_ZERO) * (1 - min(thick / THICK_ZERO, 1) / 2))
    return scores, errors


tris = common.triangles()
result = dict(triangles=len(tris))
if len(tris) == 0 or len(tris) > MAX_TRIS:
    result.update(score=0.0, reason="empty mesh" if len(tris) == 0 else "too many triangles")
    print("GRADE", json.dumps(result))
    sys.exit()

POSES = json.load(open(os.path.join(here, "poses.json")))


def grown(mask, r):
    """The mask and every pixel within r pixels of it."""
    h, w = mask.shape
    pad, out = np.pad(mask, r), np.zeros_like(mask)
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dx * dx + dy * dy <= r * r:
                out |= pad[r + dy:r + dy + h, r + dx:r + dx + w]
    return out


def overlap(pred, gt):
    """Outline IoU where a pixel within OUTLINE_PX of the other outline counts as shared: where a part sits is
    judged against the whole object, as the surface's CHAMFER_FREE is. How thick it is, the surface judges."""
    shared = ((pred & grown(gt, OUTLINE_PX)).sum() + (gt & grown(pred, OUTLINE_PX)).sum()) / 2
    return float(shared / max(pred.sum() + gt.sum() - shared, 1))


def views_iou(prefix, tmp):
    out = []
    for v in range(len(common.VIEWS)):
        common.set_camera(v)
        common.render(f"{tmp}/{prefix}{v}.png")
        pred, gt = common.load_mask(f"{tmp}/{prefix}{v}.png"), np.load(f"{hidden}/{prefix}{v}.npy")
        out.append(overlap(pred, gt))
    return out


common.setup_render(MASK_RES, mask=True)
pose_ious = {}
with tempfile.TemporaryDirectory() as tmp:
    ious = views_iou("mask_", tmp)
    for name, angles in POSES.items():
        undo = common.pose(angles)
        pose_ious[name] = views_iou(f"pose_{name}_", tmp)
        common.unpose(undo)

# Exact point-to-surface distance both ways, so there is no sampling noise floor
gt_tris = np.load(f"{hidden}/tris.npy")
diag = np.linalg.norm(gt_tris.reshape(-1, 3).max(0) - gt_tris.reshape(-1, 3).min(0))
scores, errors = part_scores(tris, gt_tris, diag)

photo_views = common.PHOTOS
iou_ref = float(np.mean([ious[v] for v in photo_views]))
iou_hidden = float(np.mean([iou for v, iou in enumerate(ious) if v not in photo_views]))
chamfer_score = float(np.mean(scores))
iou_poses = float(np.mean([np.mean(x) for x in pose_ious.values()])) if pose_ious else None
# Outline times surface, so both have to be right: a box the right size matches the outline, and
# averaged in, that alone scored three quarters with every small part missing. The outline is the
# worse of at rest and bent, so a hinge that does not work costs as much as it misses by.
outline = (iou_ref + iou_hidden) / 2
if iou_poses is not None:
    outline = min(outline, iou_poses)
base = outline * chamfer_score
result.update(
    iou_ref=round(iou_ref, 3), iou_hidden=round(iou_hidden, 3), ious=[round(i, 3) for i in ious],
    parts=len(scores), part_scores=[round(x, 3) for x in scores], chamfer=round(float(np.mean(errors)), 4),
    chamfer_score=round(chamfer_score, 3),
    **({"iou_poses": round(iou_poses, 3), "pose_ious": {k: [round(i, 3) for i in v] for k, v in pose_ious.items()}}
       if iou_poses is not None else {}),
    **(st := structure.structure(tris, gt_tris)),
    # Structure only ever costs: a plain box stands on the floor in one piece, and must not earn for it.
    # It is all that sees a solid panel where the real one has gaps, so it costs up to 40%
    score=round(base * (0.6 + 0.4 * st["structure"]), 3),
    score_without_structure=round(base, 3),
)
print("GRADE", json.dumps(result))
`,ut=`"""Models made from your gold.py's object, which the grader has to judge the way a person would: the
real object a hair off passes, a block where it has parts scores low, and no object scores nothing.

python3 /tests/ladder.py, in the grader image: builds the real object from /tests/gold.py, makes each
model in RUNGS from it, grades each with report.py, and writes them to /out/reward.json as
{"rungs": [{"name", "tier", "reward", "strict_pass", "reason", "na"?}]}, "na" saying why a rung tells nothing for
this object. What each tier must score is DOP's
(dop/bundle.py LADDER).
"""
import json
import os
import re
import shutil
import subprocess
import sys

RUNGS = [
    ("scale_1.01", "valid"), ("scale_0.99", "valid"), ("shifted", "valid"), ("remeshed", "valid"), ("open", "valid"),
    ("bbox", "crude"), ("bbox_each", "crude"), ("hull", "crude"), ("thick", "crude"),
    ("empty", "garbage"), ("scale_10x", "garbage"),
]
WORK = "/tmp/ladder"
# the remeshed model's budget, four fifths of the grader's own cap
MAX_TRIS = int(re.search(r"^MAX_TRIS = ([\\d_]+)", open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "grade.py")).read(),
                         re.M).group(1).replace("_", ""))
TRIS = MAX_TRIS * 4 // 5

try:
    import bpy
except ImportError:
    os.makedirs(WORK, exist_ok=True)
    subprocess.run(["python3", "/tests/gold.py"], check=True)
    subprocess.run(["blender", "-b", "/app/model.blend", "-P", __file__, "--", WORK], check=True)
    na = json.load(open(f"{WORK}/na.json"))
    rungs = []
    for name, tier in RUNGS:
        shutil.copy(f"{WORK}/{name}.blend", "/app/model.blend")
        subprocess.run(["python3", "/tests/report.py"], check=True, capture_output=True)
        r = json.load(open("/out/reward.json"))
        rungs.append(dict(name=name, tier=tier, reward=r["reward"], strict_pass=r["strict_pass"], reason=r["info"].get("reason"),
                          **({"na": na[name]} if name in na else {})))
        print("RUNG", json.dumps(rungs[-1]), flush=True)
    json.dump({"rungs": rungs}, open("/out/reward.json", "w"), indent=2)
    sys.exit(0)

import math

import bmesh
import numpy as np
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common

work = sys.argv[sys.argv.index("--") + 1]
gold = bpy.data.filepath
points = np.unique(common.triangles().reshape(-1, 3), axis=0)
diag = float(np.linalg.norm(points.max(0) - points.min(0)))


def meshes():
    return [o for o in bpy.data.objects if o.type == "MESH"]


def move(m):
    """The whole scene moved by m about the world origin; hinges and names kept."""
    for o in bpy.data.objects:
        if o.parent is None:
            o.matrix_basis = m @ o.matrix_basis


def realize(o):
    """o's mesh as it renders, modifiers applied, in o's own frame, as a bmesh to write back with bm.to_mesh(o.data)."""
    o.data = bpy.data.meshes.new_from_object(o.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    o.modifiers.clear()
    bm = bmesh.new()
    bm.from_mesh(o.data)
    return bm


def cube(bm, lo, hi):
    bmesh.ops.create_cube(bm, size=1, matrix=Matrix.Translation((lo + hi) / 2) @ Matrix.Diagonal((*(hi - lo), 1)))


def only(bm):
    """The scene replaced by one object of bm's mesh: no names, so no hinges."""
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    me = bpy.data.meshes.new("model")
    bm.to_mesh(me)
    bm.free()
    bpy.context.scene.collection.objects.link(bpy.data.objects.new("model", me))


def remeshed():
    """Every object rebuilt from voxels a third of the free surface band across, larger where it is flat:
    the same shape, other triangles, about as many as a model made by hand."""
    for o in meshes():
        m = o.modifiers.new("remesh", "REMESH")
        m.mode, m.voxel_size, m.adaptivity = "VOXEL", 0.003 * diag / max(o.matrix_world.to_scale()), 0.5
    # a large object's flat faces come out of the voxels in more triangles than the grader takes: flat runs of
    # voxel faces merged first, then only the objects over their share thinned, so small parts keep their shape
    if len(common.triangles()) > TRIS:
        for o in meshes():
            d = o.modifiers.new("flat", "DECIMATE")
            d.decimate_type, d.angle_limit = "DISSOLVE", math.radians(1)
        counts = {o: tris_of(o) for o in meshes()}
        if sum(counts.values()) > TRIS:
            share = TRIS / len(counts)
            big = sum(n for n in counts.values() if n > share)
            ratio = max((TRIS - (sum(counts.values()) - big)) / big, 0.05)
            for o, n in counts.items():
                if n > share:
                    o.modifiers.new("thin", "DECIMATE").ratio = ratio
    # and the voxels stand a little below a face on the floor: lifted back onto it, never pushed down
    drop = points[:, 2].min() - common.triangles().reshape(-1, 3)[:, 2].min()
    if drop > 0:
        move(Matrix.Translation((0, 0, drop)))


def tris_of(o):
    ev = o.evaluated_get(bpy.context.evaluated_depsgraph_get())
    me = ev.to_mesh()
    me.calc_loop_triangles()
    n = len(me.loop_triangles)
    ev.to_mesh_clear()
    return n


def scaled(k):
    """The whole scene scaled by k about the middle of the object's footprint on the floor, so it stays on it
    wherever it stands: no point moves more than the free surface band."""
    c = Vector(((points[:, 0].min() + points[:, 0].max()) / 2, (points[:, 1].min() + points[:, 1].max()) / 2, points[:, 2].min()))
    move(Matrix.Translation(c) @ Matrix.Scale(k, 4) @ Matrix.Translation(-c))


def bbox():
    bm = bmesh.new()
    cube(bm, points.min(0), points.max(0))
    only(bm)


def bbox_each():
    """Every object its own bounding box, in its own frame, so it still turns on its hinge."""
    for o in meshes():
        bm = realize(o)
        co = np.array([v.co for v in bm.verts])
        bm.clear()
        cube(bm, co.min(0), co.max(0))
        bm.to_mesh(o.data)
        bm.free()


def hull():
    bm = bmesh.new()
    for p in points:
        bm.verts.new(p)
    bmesh.ops.convex_hull(bm, input=bm.verts)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    only(bm)


def thick():
    """Every connected piece twice as thick across its two thinnest directions, about its own middle: a rod drawn as a bar."""
    for o in meshes():
        bm = realize(o)
        left = set(bm.verts)
        while left:
            piece, todo = [], [left.pop()]
            while todo:
                v = todo.pop()
                piece.append(v)
                for e in v.link_edges:
                    w = e.other_vert(v)
                    if w in left:
                        left.remove(w)
                        todo.append(w)
            co = np.array([v.co for v in piece])
            axes = np.linalg.svd(co - co.mean(0), full_matrices=False)[2]
            local = (co - co.mean(0)) @ axes.T
            mid = (local.max(0) + local.min(0)) / 2
            grow = np.ones(len(axes))
            grow[np.argsort(local.max(0) - local.min(0))[:2]] = 2
            for v, p in zip(piece, ((local - mid) * grow + mid) @ axes + co.mean(0)):
                v.co = p
        bm.to_mesh(o.data)
        bm.free()


def open_bottom():
    """The biggest face looking down deleted: an open shell where the real object is closed, the same from every camera."""
    faces = []
    for o in meshes():
        bm = realize(o)
        bm.transform(o.matrix_world)
        bm.normal_update()
        faces += [(f.calc_area(), o.name, f.index) for f in bm.faces if f.normal.z < -0.9]
        bm.free()
    _, name, i = max(faces)
    me = bpy.data.objects[name].data
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[bm.faces[i]], context="FACES_ONLY")
    bm.to_mesh(me)
    bm.free()


def empty():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)


MAKE = {
    "scale_1.01": lambda: scaled(1.01),
    "scale_0.99": lambda: scaled(0.99),
    # a fifth of the free surface band, sideways so it stays on the floor
    "shifted": lambda: move(Matrix.Translation((0.002 * diag, 0.002 * diag, 0))),
    "remeshed": remeshed,
    "open": open_bottom,
    "bbox": bbox,
    "bbox_each": bbox_each,
    "hull": hull,
    "thick": thick,
    "empty": empty,
    "scale_10x": lambda: move(Matrix.Scale(10, 4)),
}

def fills_its_boxes():
    """Whether every object already fills its own bounding box, nine tenths or more: then bbox_each is the
    object itself, not a crude one, and says nothing about the grader."""
    for o in meshes():
        bm = realize(o)
        co = np.array([v.co for v in bm.verts])
        box = float(np.prod(co.max(0) - co.min(0)))
        vol = bm.calc_volume(signed=False)
        bm.free()
        if box > 0 and vol < 0.9 * box:
            return False
    return True


na = {"bbox_each": "the object's parts are already boxes"} if fills_its_boxes() else {}
json.dump(na, open(f"{work}/na.json", "w"))

for name, _ in RUNGS:
    bpy.ops.wm.open_mainfile(filepath=gold)
    MAKE[name]()
    bpy.ops.wm.save_as_mainfile(filepath=f"{work}/{name}.blend")
`,dt=`"""Split a triangle soup into parts: its connected pieces, found by shared vertex positions."""
import numpy as np


def islands(tris):
    """Part id per triangle."""
    _, vid = np.unique(np.round(tris.reshape(-1, 3), 6), axis=0, return_inverse=True)
    vid = vid.reshape(-1, 3)
    parent = np.arange(vid.max() + 1)

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for a, b, c in vid:
        ra, rb, rc = find(a), find(b), find(c)
        parent[rb] = ra
        parent[find(rc)] = ra
    roots = np.array([find(v) for v in vid[:, 0]])
    return np.unique(roots, return_inverse=True)[1]
`,ft=`"""Render a .blend from one of the task's cameras, shaded like the photos.

blender -b model.blend -P render.py -- out.png [view]
blender -b model.blend -P render.py -- --photos <dir>     every photo view, as photo_<view>.png
"""
import os
import sys

import bpy

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import common

args = sys.argv[sys.argv.index("--") + 1:]
common.setup_render(512, mask=False)
if args[0] == "--photos":
    os.makedirs(args[1], exist_ok=True)
    for v in common.PHOTOS:
        common.set_camera(v)
        common.render(os.path.join(os.path.abspath(args[1]), f"photo_{v}.png"))
else:
    common.set_camera(int(args[1]) if len(args) > 1 else 0)
    common.render(os.path.abspath(args[0]))
`,pt=`"""Grade /app/model.blend against the hidden object and write /out/reward.json.

The score is grade.py's: silhouette overlap from the photos' cameras and from cameras the agent
never saw, or, when poses.json names poses, with the joints bent if that is worse; times surface
distance part by part; times a structure penalty (on the floor, in one piece, the right number of holes).
Strict pass is every check passing.
"""
import json
import math
import os
import subprocess
import sys

NOTES = {
    "photo_views": "Its outline matches the real object's from the cameras the photos were taken from.",
    "hidden_views": "Its outline matches from cameras the agent has no photo from.",
    "surface": "Every part of the real object is there, in the right place and shape, as thick as the real one.",
    "structure": "It stands on the floor, holds together, and has as many holes as the real one.",
    "poses": "Bent at its joints, it still matches: the hinges are real, where the real ones are.",
}

# each check: what it measures, grade.py's name for that, and the bar it has to clear
BARS = {
    "photo_views": ("outline overlap", "iou_ref", 0.9),
    "hidden_views": ("outline overlap", "iou_hidden", 0.9),
    "surface": ("surface score", "chamfer_score", 0.9),
    "structure": ("structure score", "structure", 0.99),
    "poses": ("outline overlap when bent", "iou_poses", 0.9),
}

out = {"reward": 0.0, "strict_pass": False, "failure_category": "wrong_answer", "counters": {}, "info": {}}

if not os.path.exists("/tests/hidden/tris.npy"):
    sys.exit("the hidden ground truth is missing: the grader image is broken, not the model")
try:
    r = subprocess.run(["blender", "-b", "/app/model.blend", "-P", "/tests/grade.py", "--", "/tests/hidden"],
                       capture_output=True, text=True, timeout=540)
except subprocess.TimeoutExpired:
    r = None
line = next((l for l in r.stdout.splitlines() if l.startswith("GRADE ")), None) if r else None
if r is None:
    out["info"] = {"reason": "grading /app/model.blend took over 9 minutes"}
elif line is None:
    # Blender could not open the file, grade.py raised on what it found in it, or Blender itself died part
    # way (a crash, the GPU, killed for memory): only the last is not the submission's fault, so no
    # reward.json: the run is an error, left out of the score, not the model's 0 (task-mvpayr4x's stool
    # scored 0 so on 2026-10-26, and 1.0 graded again). grade.py says GRADING once Blender has loaded it.
    log = (r.stdout + r.stderr)[-1500:]
    loaded = "GRADING" in r.stdout.splitlines()
    if loaded and "Traceback (most recent call last)" not in r.stdout + r.stderr:
        sys.exit(f"Blender loaded /app/model.blend, then died before grading it (exit {r.returncode}): "
                 f"the grader failed, not the model\\n{log}")
    out["info"] = {"reason": "grading /app/model.blend failed on what is in it" if loaded
                   else "Blender could not read /app/model.blend", "exit_code": r.returncode, "log": log}
else:
    g = json.loads(line[len("GRADE "):])
    # poses only when poses.json names some
    checks = {k: g.get(key, 0.0) >= bar for k, (_, key, bar) in BARS.items() if k != "poses" or "iou_poses" in g}
    failed = sorted(k for k, ok in checks.items() if not ok)
    # what a failed check measured, against its bar: rounded down, as 0.897 rounded up reads as the 0.9 it missed
    missed = {k: f"{BARS[k][0]} {math.floor(g.get(BARS[k][1], 0.0) * 1000) / 1000}, needs {BARS[k][2]}." for k in failed}
    out.update(reward=float(g["score"]), strict_pass=not failed, failure_category=None if not failed else "wrong_answer")
    out["counters"] = {k: float(g[k]) for k in ("iou_ref", "iou_hidden", "chamfer_score", "iou_poses", "structure", "triangles") if k in g}
    out["info"] = {"checks": sorted(checks), "failed": failed, "check_notes": {k: NOTES[k] for k in checks}, "missed": missed,
                   "part_scores": g.get("part_scores"), "ious": g.get("ious"), "pose_ious": g.get("pose_ious"),
                   "reason": g.get("reason")}

os.makedirs("/out", exist_ok=True)
json.dump(out, open("/out/reward.json", "w"), indent=2)
print(json.dumps(out))
`,mt=`"""Write /app/model.blend, the file a Blender GUI task's desktop opens and the agent saves: an
empty scene with a camera per photo, named photo_<view>, standing where that photo was taken with
the photo as its background, and the 3D view looking through the first. It is written over the real object once the photos are
rendered from it. The photos are read from /photos, where the build stage rendered them, tinted
and packed into the file.

blender -b --factory-startup -P start.py
"""
import os
import sys

import bpy
import numpy as np

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import common

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.resolution_x = scene.render.resolution_y = 512     # the photos' frame, so the backgrounds line up
for v in common.PHOTOS:
    common.set_camera(v)
    cam = scene.camera
    cam.name = cam.data.name = f"photo_{v}"     # set_camera makes a new TaskCamera next time round
    cam.data.show_background_images = True
    image = bpy.data.images.load(f"/photos/photo_{v}.png")
    # tinted blue and framed, so it reads as a photo behind the scene, not as a part already in it
    w, h = image.size
    px = np.empty(w * h * 4, np.float32)
    image.pixels.foreach_get(px)
    px = px.reshape(h, w, 4)
    px[..., :3] *= (0.45, 0.65, 1.0)
    px[:8, :, :3] = px[-8:, :, :3] = px[:, :8, :3] = px[:, -8:, :3] = (0.45, 0.65, 1.0)
    image.pixels.foreach_set(px.ravel())
    image.pack()
    bg = cam.data.background_images.new()
    bg.image = image
    bg.alpha = 0.6
scene.camera = bpy.data.objects[f"photo_{common.PHOTOS[0]}"]
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == "VIEW_3D":
            area.spaces[0].region_3d.view_perspective = "CAMERA"
# no Scripting tab to go looking in: the desktop deletes that workspace only once it is opened
bpy.data.batch_remove([bpy.data.workspaces["Scripting"]])
os.makedirs("/app", exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath="/app/model.blend")
`,ht=`"""Structure checks: does the model stand on the floor, hold together, and have the right number of holes.

Each check scores 0 to 1 and compares against the real object where it can, so nothing the real
object also does is ever punished.
"""
import numpy as np
from mathutils.bvhtree import BVHTree

import parts

FLOOR_FREE, FLOOR_ZERO = 0.002, 0.020      # lowest point this far from z = 0 is free / scores 0
TOUCH = 0.003                              # parts this close count as joined
VOXEL = 0.005                              # cube size for counting holes
CELLS = 320                                # at most this many cubes along the longest side: a model
                                           # modelled in cm, 100 times over, filled 400 GB at 5 mm. At 200
                                           # a 1.5 m bench went to 7.5 mm and lost count of its 2 cm slat gaps
HOLE_COST = 0.25                           # score lost per hole too many or too few


def floor_score(tris):
    """How far the lowest point is from the floor, sinking or floating."""
    off = abs(float(tris.reshape(-1, 3)[:, 2].min()))
    return 1.0 if off <= FLOOR_FREE else max(0.0, 1 - (off - FLOOR_FREE) / (FLOOR_ZERO - FLOOR_FREE))


def _tree(t):
    v = t.reshape(-1, 3)
    return BVHTree.FromPolygons(v.tolist(), np.arange(len(v)).reshape(-1, 3).tolist(), all_triangles=True)


def _area(t):
    return float(np.linalg.norm(np.cross(t[:, 1] - t[:, 0], t[:, 2] - t[:, 0]), axis=1).sum() / 2)


def connected_score(tris, samples=400, seed=0):
    """Share of the surface in the largest group of parts that touch (within TOUCH)."""
    import common
    part_of = parts.islands(tris)
    n = part_of.max() + 1
    if n == 1:
        return 1.0
    groups = [tris[part_of == k] for k in range(n)]
    area = np.array([_area(g) for g in groups])
    lo = np.array([g.reshape(-1, 3).min(0) for g in groups]) - TOUCH
    hi = np.array([g.reshape(-1, 3).max(0) + TOUCH for g in groups])
    trees = [_tree(g) for g in groups]
    pts = [common.surface_points(g, samples, seed=seed + k) for k, g in enumerate(groups)]
    root = list(range(n))

    def find(a):
        while root[a] != a:
            root[a] = root[root[a]]
            a = root[a]
        return a

    for i in range(n):
        for j in range(i + 1, n):
            if find(i) == find(j) or np.any(lo[i] > hi[j]) or np.any(lo[j] > hi[i]):
                continue
            small, big = (i, j) if area[i] <= area[j] else (j, i)
            if any(trees[big].find_nearest(p, TOUCH)[0] is not None for p in pts[small]):
                root[find(i)] = find(j)
    group_area = {}
    for k in range(n):
        group_area[find(k)] = group_area.get(find(k), 0.0) + area[k]
    return float(max(group_area.values()) / area.sum())


def _labels(pairs, n):
    """Connected-component label per node 0..n-1 over the given (a, b) pairs: the smallest node of its component."""
    label = np.arange(n)
    while True:
        low = np.minimum(label[pairs[:, 0]], label[pairs[:, 1]])
        new = label.copy()
        np.minimum.at(new, pairs[:, 0], low)
        np.minimum.at(new, pairs[:, 1], low)
        new = new[new]                          # pointer jumping: follow labels to their root
        if (new == label).all():
            return label
        label = new


def _capped(tris):
    """The triangles plus a fan from every boundary loop to its middle: a face left out of a closed part
    would let the outside flood into it, and a hollow part counts holes where its insides meet others."""
    pts, vid = np.unique(np.round(tris.reshape(-1, 3), 6), axis=0, return_inverse=True)
    edges, uses = np.unique(np.sort(vid.reshape(-1, 3)[:, [0, 1, 1, 2, 2, 0]].reshape(-1, 2), axis=1), axis=0,
                            return_counts=True)
    edges = edges[uses == 1]
    loop = _labels(edges, len(pts))
    ends = np.unique(edges)
    middle = np.zeros((len(pts), 3))
    np.add.at(middle, loop[ends], pts[ends])
    middle /= np.bincount(loop[ends], minlength=len(pts)).clip(1)[:, None]
    return np.concatenate([tris, np.stack([pts[edges[:, 0]], pts[edges[:, 1]], middle[loop[edges[:, 0]]]], 1)])


def _solid(tris, lo, shape, voxel):
    """Voxels inside or on the surface: mark surface voxels, flood the outside, keep the rest."""
    step = voxel / 3
    a, b, c = tris[:, 0], tris[:, 1], tris[:, 2]
    edge = np.maximum.reduce([np.linalg.norm(b - a, axis=1), np.linalg.norm(c - a, axis=1), np.linalg.norm(c - b, axis=1)])
    grid = np.zeros(shape, bool)
    # no cap on samples along an edge: capped at 400, a triangle over 400 steps long left gaps in the shell, and
    # a chair at 2.7 m counted 271 holes. In batches of a few million points instead, so long triangles fit
    counts = np.ceil(edge / step).astype(int).clip(1)
    for count in np.unique(counts):
        sel = np.flatnonzero(counts == count)
        u, v = np.meshgrid(np.linspace(0, 1, count + 1), np.linspace(0, 1, count + 1))
        keep = (u + v) <= 1
        u, v = u[keep], v[keep]
        batch = max(1, 4_000_000 // len(u))
        for i in range(0, len(sel), batch):
            s = sel[i:i + batch]
            p = a[s][:, None] + u[None, :, None] * (b[s] - a[s])[:, None] + v[None, :, None] * (c[s] - a[s])[:, None]
            idx = np.floor((p.reshape(-1, 3) - lo) / voxel).astype(int)
            idx = idx[np.all((idx >= 0) & (idx < shape), axis=1)]
            grid[idx[:, 0], idx[:, 1], idx[:, 2]] = True
    # grow the outside inward from the grid's border one layer per pass, through empty voxels only
    outside = np.zeros(shape, bool)
    outside[[0, -1], :, :] = outside[:, [0, -1], :] = outside[:, :, [0, -1]] = True
    outside &= ~grid
    while True:
        grown = outside.copy()
        grown[1:] |= outside[:-1]; grown[:-1] |= outside[1:]
        grown[:, 1:] |= outside[:, :-1]; grown[:, :-1] |= outside[:, 1:]
        grown[:, :, 1:] |= outside[:, :, :-1]; grown[:, :, :-1] |= outside[:, :, 1:]
        grown &= ~grid
        if (grown == outside).all():
            break
        outside = grown
    return ~outside


def holes(tris, voxel):
    """Through-holes of the solid (first Betti number), from its Euler characteristic.

    The solid has no enclosed cavities (the outside flood fills them in), so b1 = b0 - chi, where b0 is
    the number of face-connected pieces and chi = V - E + F - C over the union of the voxel cubes.
    """
    v = tris.reshape(-1, 3)
    lo = v.min(0) - 2 * voxel
    shape = tuple(np.ceil((v.max(0) + 2 * voxel - lo) / voxel).astype(int))
    solid = _solid(_capped(tris), lo, shape, voxel)
    cubes = np.argwhere(solid)
    if len(cubes) == 0:
        return 0

    def count(offsets):
        keys = (cubes[:, None, :] + np.array(offsets)[None]).reshape(-1, 3)
        return len(np.unique(keys, axis=0))

    corners = [(i, j, k) for i in (0, 1) for j in (0, 1) for k in (0, 1)]
    # edges, faces: encode each by its lower corner (doubled coords) so shared ones merge
    e_off, f_off = [], []
    for axis in range(3):
        for a in (0, 1):
            for b in (0, 1):
                o = [0, 0, 0]; o[(axis + 1) % 3] = 2 * a; o[(axis + 2) % 3] = 2 * b; o[axis] = 1
                e_off.append(tuple(o))
        for a in (0, 1):
            o = [1, 1, 1]; o[axis] = 2 * a
            f_off.append(tuple(o))
    doubled = cubes * 2
    V = len(np.unique((doubled[:, None, :] + 2 * np.array(corners)[None]).reshape(-1, 3), axis=0))
    E = len(np.unique((doubled[:, None, :] + np.array(e_off)[None]).reshape(-1, 3), axis=0))
    F = len(np.unique((doubled[:, None, :] + np.array(f_off)[None]).reshape(-1, 3), axis=0))
    C = len(cubes)
    chi = V - E + F - C
    # b0: face-connected pieces, by union-find over neighbouring solid voxels
    index = -np.ones(shape, np.int64)
    index[tuple(cubes.T)] = np.arange(len(cubes))
    pairs = []
    for axis in range(3):
        a_ = np.take(index, range(shape[axis] - 1), axis=axis)
        b_ = np.take(index, range(1, shape[axis]), axis=axis)
        m = (a_ >= 0) & (b_ >= 0)
        pairs.append(np.stack([a_[m], b_[m]], 1))
    b0 = len(np.unique(_labels(np.concatenate(pairs), len(cubes))))
    return b0 - chi


def structure(tris, gt_tris):
    floor = floor_score(tris)
    # relative to the real object: parts it keeps apart itself are not the model's fault
    joined = min(1.0, connected_score(tris) / connected_score(gt_tris))
    if parts.islands(gt_tris).max() == 0:
        # A single-piece real object is a scan: its voxel hole count is dominated by thin gaps
        # (laces, fur, a handle close to the body), so the check would measure noise. Skipped.
        h_model = h_real = -1
        hole = 1.0
    else:
        # the same cubes for both, coarser only where the model or the object is too big for CELLS of VOXEL
        extent = max(float(np.ptp(t.reshape(-1, 3), axis=0).max()) for t in (tris, gt_tris))
        voxel = max(VOXEL, extent / CELLS)
        h_real = holes(gt_tris, voxel)
        if any(holes(gt_tris, voxel * f) != h_real for f in (0.9, 1.1)):
            # the real object's own count moves when the cubes are a tenth bigger or smaller (gaps about a cube
            # across, slats, a handle close to the body): too fragile to hold a model to, so not graded
            h_model, hole = -1, 1.0
        else:
            h_model = holes(tris, voxel)
            hole = max(0.0, 1 - HOLE_COST * abs(h_model - h_real))
    return dict(floor=round(floor, 3), connected=round(joined, 3), holes_model=int(h_model), holes_real=int(h_real),
                holes=round(hole, 3), structure=round((floor + joined + hole) / 3, 3))
`,gt=`"""Write the hidden ground truth grade.py reads, at image build time, from your gold.py's model:
its triangles, and its silhouette from every camera, at rest and in each pose of poses.json.

blender -b /app/model.blend -P truth.py -- <out_dir>
"""
import json
import os
import sys

import numpy as np

out = os.path.abspath(sys.argv[sys.argv.index("--") + 1])
here = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, here)
import common

POSES = json.load(open(os.path.join(here, "poses.json")))


def masks(prefix):
    for v in range(len(common.VIEWS)):
        common.set_camera(v)
        common.render(f"{out}/{prefix}{v}.png")
        np.save(f"{out}/{prefix}{v}.npy", common.load_mask(f"{out}/{prefix}{v}.png"))
        os.remove(f"{out}/{prefix}{v}.png")


os.makedirs(out, exist_ok=True)
common.setup_render(512, mask=True)
masks("mask_")
for name, angles in POSES.items():
    undo = common.pose(angles)
    masks(f"pose_{name}_")
    common.unpose(undo)
np.save(f"{out}/tris.npy", common.triangles())
print("TRUTH", len(common.triangles()), "triangles,", len(POSES), "poses")
`,_t=`# The withheld half, for a Blender GUI task: the desktop image's Blender, run headless, the grader,
# and your gold.py, which builds the real object here, at build time, so the ground truth is never
# in the agent's box.
FROM BLENDER_IMAGE
COPY verifier/ /tests/
# the camera rig is the agent's own copy, so the grader cannot frame the object differently
COPY environment/data/common.py /tests/common.py
COPY references/gold.py /tests/gold.py
RUN mkdir -p /app && python3 /tests/gold.py && blender -b /app/model.blend -P /tests/truth.py -- /tests/hidden \\
 && rm -rf /app && mkdir -p /app /out
`,vt=`# The withheld half, for a Blender task: the same Blender, the grader, and your gold.py, which
# builds the real object here, at build time, so the ground truth is never in the agent's box.
FROM debian:12-slim@sha256:3783cc01769c7b2b1b83a5c5ad96c815348e28ed7da68e2e3687004faa906251 AS blender
ARG BLENDER=5.2.2
ARG BLENDER_SHA256=84098912789dc450e95697c4184fb8a90acbe5111c2ba4aede3fecb57806a168
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl xz-utils \\
 && curl -fsSL -o /tmp/blender.tar.xz https://download.blender.org/release/Blender\${BLENDER%.*}/blender-\${BLENDER}-linux-x64.tar.xz \\
 && echo "\${BLENDER_SHA256}  /tmp/blender.tar.xz" | sha256sum -c - \\
 && mkdir /opt/blender && tar -xJf /tmp/blender.tar.xz -C /opt/blender --strip-components=1

FROM debian:12-slim@sha256:3783cc01769c7b2b1b83a5c5ad96c815348e28ed7da68e2e3687004faa906251
RUN apt-get update && apt-get install -y --no-install-recommends \\
      libx11-6 libxi6 libxxf86vm1 libxfixes3 libxrender1 libxkbcommon0 libsm6 libice6 \\
      libgl1 libegl1 libegl-mesa0 libgl1-mesa-dri libglu1-mesa libgles2 python3 \\
 && rm -rf /var/lib/apt/lists/*
COPY --from=blender /opt/blender /opt/blender
RUN ln -s /opt/blender/blender /usr/local/bin/blender

COPY verifier/ /tests/
# the camera rig is the agent's own copy, so the grader cannot frame the object differently
COPY environment/data/common.py /tests/common.py
COPY references/gold.py /tests/gold.py
RUN mkdir -p /app && python3 /tests/gold.py && blender -b /app/model.blend -P /tests/truth.py -- /tests/hidden \\
 && rm -rf /app && mkdir -p /app /out
`,V=`debian:12-slim@sha256:3783cc01769c7b2b1b83a5c5ad96c815348e28ed7da68e2e3687004faa906251`,yt=`libx11-6, libxi6, libxxf86vm1, libxfixes3, libxrender1, libxkbcommon0, libsm6, libice6, libgl1, libegl1, libegl-mesa0, libgl1-mesa-dri, libglu1-mesa, libgles2, python3`,bt=a(vt),xt=[`COPY environment/data/ /w/`,`COPY references/gold.py /w/gold.py`,`RUN mkdir -p /app && python3 /w/gold.py && blender -b /app/model.blend -P /w/render.py -- --photos /photos`],St=a([`FROM ${V} AS blender`,`ARG BLENDER=5.2.2`,`ARG BLENDER_SHA256=84098912789dc450e95697c4184fb8a90acbe5111c2ba4aede3fecb57806a168`,`RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl xz-utils \\`," && curl -fsSL -o /tmp/blender.tar.xz https://download.blender.org/release/Blender${BLENDER%.*}/blender-${BLENDER}-linux-x64.tar.xz \\",' && echo "${BLENDER_SHA256}  /tmp/blender.tar.xz" | sha256sum -c - \\',` && mkdir /opt/blender && tar -xJf /tmp/blender.tar.xz -C /opt/blender --strip-components=1`,``,`# the photos, rendered from your gold.py; the box below takes the PNGs and nothing else from here`,`FROM ${V} AS photos`,`RUN apt-get update && apt-get install -y --no-install-recommends ${yt.split(`, `).join(` `)} && rm -rf /var/lib/apt/lists/*`,`COPY --from=blender /opt/blender /opt/blender`,`RUN ln -s /opt/blender/blender /usr/local/bin/blender`,...xt,``].join(`
`)).split(`
`),Ct=[`COPY --from=blender /opt/blender /opt/blender`,`RUN ln -s /opt/blender/blender /usr/local/bin/blender`,`COPY --from=photos /photos/ /app/photos/`],wt=e=>[`# the photos, rendered from your gold.py, and the scene the desktop opens; the box below takes those and nothing else from here`,`FROM ${e} AS photos`,...xt,`RUN blender -b --factory-startup -P /w/start.py`,``],Tt=[`COPY --from=photos /photos/ /app/photos/`,`COPY --from=photos /app/model.blend /app/model.blend`],Et=e=>_t.replace(`BLENDER_IMAGE`,e),Dt={"environment/data/common.py":ct,"environment/data/render.py":ft,"verifier/report.py":pt,"verifier/grade.py":lt,"verifier/ladder.py":ut,"verifier/truth.py":gt,"verifier/parts.py":dt,"verifier/structure.py":ht,"verifier/poses.json":`{}
`},Ot={...Dt,"environment/data/start.py":mt},kt=`"""The real object. Run as python3, it hands itself to Blender and saves /app/model.blend."""
import subprocess
import sys

try:
    import bpy
except ImportError:
    subprocess.run(["blender", "-b", "--python", __file__], check=True)
    sys.exit(0)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.mesh.primitive_cylinder_add(radius=0.1, depth=0.02, location=(0, 0, 0.01))
bpy.context.object.name = "base"
# ... the rest of it; a part the grader bends (poses.json) is its own object, origin on its hinge

bpy.ops.wm.save_as_mainfile(filepath="/app/model.blend")
`,At=`"""Grade a saved FreeCAD part against the real one gold.py built: how much solid they share, whether
it is the right size and in the right place, and, for each feature verifier/features.json names,
whether the part is solid or empty at every point listed for it exactly where the real one is.

GRADE_MODEL=/app/part.FCStd GRADE_HIDDEN=/tests/hidden freecadcmd grade.py      prints GRADE {json}

The part is every visible object with a solid that no other solid is built from: a Part Design
Body, a Part boolean's result, a lone primitive. Hidden objects are not graded. A binder, a mirror
or a link only refers to the solid it copies, so the solid it copies still counts.

A broken real part prints BROKEN {reason}: the grader's fault, not the model's. READ {path} once the
model's file is open, so a crash after it is the grader's too.
"""
import json
import os
import sys

import FreeCAD
from FreeCAD import Vector as V

CONTAINERS = ("App::Part", "App::DocumentObjectGroup", "App::Origin")
# objects that copy a solid and leave it standing: what they copy is still part of the part
REFERENCES = ("PartDesign::SubShapeBinder", "PartDesign::ShapeBinder", "Part::Mirroring", "App::Link")
IOU_FLOOR = 0.90        # shared solid at or below this scores 0; the score climbs to 1 at an exact match
SIZE_ZERO = 2.0         # mm of bounding box error that scores 0
BUILT_IN = ("solid", "size")  # the grader's own checks, which a feature may not be named


def clone(o):
    """A Draft clone, which is a Python feature rather than a type of its own."""
    return getattr(getattr(o, "Proxy", None), "Type", None) == "Clone"


def broken(reason):
    print("BROKEN", reason, flush=True)    # freecadcmd drops what is unflushed when the script exits
    sys.exit(1)


def placed(o):
    """o's solid where it sits in the document: inside an App::Part it is in the Part's own coordinates."""
    s = o.Shape.copy()
    s.Placement = o.getGlobalPlacement()
    return s


def part_of(doc):
    shapes = [placed(o) for o in doc.Objects
              if hasattr(o, "Shape") and not o.Shape.isNull() and o.Shape.Solids and o.TypeId not in CONTAINERS
              and getattr(o, "Visibility", True)
              and not any(hasattr(p, "Shape") and p.TypeId not in CONTAINERS + REFERENCES and not clone(p) for p in o.InList)]
    if not shapes:
        return None
    s = shapes[0]
    for other in shapes[1:]:
        s = s.fuse(other)
    return s


model_path, hidden = os.environ["GRADE_MODEL"], os.environ["GRADE_HIDDEN"]
here = os.path.dirname(os.path.abspath(__file__))
FEATURES = json.load(open(os.path.join(here, "features.json")))
if taken := sorted(set(FEATURES) & set(BUILT_IN)):
    broken(f"verifier/features.json: {', '.join(taken)} is the grader's own check; name the feature something else")
truth = part_of(FreeCAD.openDocument(os.path.join(hidden, "truth.FCStd")))
if truth is None:
    broken("the real part gold.py saved has no visible solid: gold.py has to leave the part visible")
result = {}
try:
    model = None
    if os.path.exists(model_path):
        doc = FreeCAD.openDocument(model_path)
        # read: FreeCAD dying from here on, rather than raising, is this grader's failure (report.py)
        print("READ", model_path, flush=True)
        model = part_of(doc)
    if model is None:
        result.update(score=0.0, reason="no visible solid in /app/part.FCStd" if os.path.exists(model_path) else "/app/part.FCStd was not saved")
    else:
        iou = truth.common(model).Volume / truth.fuse(model).Volume
        # tight boxes: Shape.BoundBox can stand off curved and filleted faces by more than the size bar
        tb, mb = truth.optimalBoundingBox(), model.optimalBoundingBox()
        size_err = max(abs(a - b) for a, b in zip((tb.XMin, tb.YMin, tb.ZMin, tb.XMax, tb.YMax, tb.ZMax),
                                                  (mb.XMin, mb.YMin, mb.ZMin, mb.XMax, mb.YMax, mb.ZMax)))
        # the real part says which side of each point is solid: the author names points, not answers
        features = {name: all(truth.isInside(V(*p), 1e-4, True) == model.isInside(V(*p), 1e-4, True) for p in points)
                    for name, points in FEATURES.items()}
        iou_score = min(1.0, max(0.0, (iou - IOU_FLOOR) / (1 - IOU_FLOOR)))
        size_score = max(0.0, 1 - size_err / SIZE_ZERO)
        if features:
            feature_score = sum(features.values()) / len(features)
            score = 0.25 * iou_score + 0.15 * size_score + 0.6 * feature_score
        else:
            feature_score, score = None, 0.6 * iou_score + 0.4 * size_score
        result.update(iou=round(iou, 4), iou_score=round(iou_score, 3), size_err=round(size_err, 3),
                      size_score=round(size_score, 3), features=features,
                      feature_score=None if feature_score is None else round(feature_score, 3),
                      volume=round(model.Volume, 1), volume_real=round(truth.Volume, 1), score=round(score, 3))
except Exception as e:
    # FreeCAD raised on what the model built (a boolean that fails, a broken shape): its 0, not
    # the grader's. Only FreeCAD dying outright after READ is the grader's (report.py)
    result = {"score": 0.0, "reason": f"/app/part.FCStd could not be measured: {type(e).__name__}: {e}"}
print("GRADE", json.dumps(result))
`,jt=`"""Grade /app/part.FCStd against the hidden real part and write /out/reward.json.

The score is grade.py's: the solid shared with the real part, its size, and each feature
verifier/features.json names, there, in place and to size. Strict pass is every check passing.
"""
import json
import math
import os
import subprocess
import sys

NOTES = {
    "solid": "It shares nearly all its solid with the real part, placed where the real one is.",
    "size": "Its overall size and position match the real part's.",
}
FEATURE_NOTE = "The {} is solid and empty at every point named for it, as on the real part."
# the two measured checks: what each measures, grade.py's name for it, and the bar it has to clear
BARS = {"solid": ("shared solid", "iou", 0.98), "size": ("size error, mm", "size_err", 0.2)}

out = {"reward": 0.0, "strict_pass": False, "failure_category": "wrong_answer", "counters": {}, "info": {}}
if not os.path.exists("/tests/hidden/truth.FCStd"):
    sys.exit("the hidden real part is missing: the grader image is broken, not the model")
try:
    r = subprocess.run(["freecadcmd", "/tests/grade.py"], capture_output=True, text=True, timeout=540,
                       env={**os.environ, "GRADE_MODEL": "/app/part.FCStd", "GRADE_HIDDEN": "/tests/hidden"})
except subprocess.TimeoutExpired:
    r = None
lines = r.stdout.splitlines() if r else []
if bad := next((l for l in lines if l.startswith("BROKEN ")), None):
    sys.exit(bad[len("BROKEN "):])
line = next((l for l in lines if l.startswith("GRADE ")), None)
if r is None:
    out["info"] = {"reason": "grading /app/part.FCStd took over 9 minutes"}
elif line is None:
    # FreeCAD could not open the file, or grade.py stopped after it had: only the first is the submission's
    # fault. The second is this grader's, so no reward.json: the run is an error, left out of the score
    log = (r.stdout + r.stderr)[-1500:]
    if any(l.startswith("READ ") for l in lines):
        sys.exit(f"FreeCAD read /app/part.FCStd, then stopped before grading it (exit {r.returncode}): "
                 f"the grader failed, not the model\\n{log}")
    out["info"] = {"reason": "FreeCAD could not read /app/part.FCStd", "exit_code": r.returncode, "log": log}
else:
    g = json.loads(line[len("GRADE "):])
    if "features" not in g:
        out["info"] = {"reason": g.get("reason")}
    else:
        checks = {"solid": g["iou"] >= BARS["solid"][2], "size": g["size_err"] <= BARS["size"][2], **g["features"]}
        notes = {k: NOTES.get(k) or FEATURE_NOTE.format(k.replace("_", " ")) for k in checks}
        failed = sorted(k for k, ok in checks.items() if not ok)
        # rounded down, as 0.979 rounded up reads as the 0.98 it missed
        missed = {k: (f"{BARS[k][0]} {math.floor(g[BARS[k][1]] * 1000) / 1000}, needs "
                      f"{'at least' if k == 'solid' else 'at most'} {BARS[k][2]}." if k in BARS else notes[k] + " It is not.")
                  for k in failed}
        out.update(strict_pass=not failed, failure_category=None if not failed else "wrong_answer")
        out["counters"] = {k: float(g[k]) for k in ("iou", "size_err", "feature_score", "volume", "volume_real") if g.get(k) is not None}
        out["info"] = {"checks": sorted(checks), "failed": failed, "check_notes": notes, "missed": missed, "features": g["features"]}
    out["reward"] = float(g.get("score", 0.0))

os.makedirs("/out", exist_ok=True)
json.dump(out, open("/out/reward.json", "w"), indent=2)
print(json.dumps(out))
`,Mt=`# The withheld half, for a FreeCAD task: the desktop image's FreeCAD, run headless as freecadcmd,
# the grader, and your gold.py, which builds the real part here, at build time, so it is never in
# the agent's box.
FROM FREECAD_IMAGE
COPY verifier/ /tests/
COPY references/gold.py /tests/gold.py
RUN mkdir -p /app /tests/hidden && python3 /tests/gold.py && mv /app/part.FCStd /tests/hidden/truth.FCStd \\
 && rm -rf /app && mkdir -p /app /out
`,Nt=e=>Mt.replace(`FREECAD_IMAGE`,e),Pt=[`RUN mkdir -p /app && freecadcmd -c "import FreeCAD; FreeCAD.newDocument('part').saveAs('/app/part.FCStd')"`],Ft={"verifier/report.py":jt,"verifier/grade.py":At,"verifier/features.json":`{}
`},It=`"""The real part. Run as python3, it hands itself to FreeCAD and saves /app/part.FCStd."""
import os
import subprocess
import sys

try:
    import FreeCAD
except ImportError:
    subprocess.run(["freecadcmd", os.path.abspath(__file__)], check=True)
    sys.exit(0)

import Part
from FreeCAD import Vector as V

part = Part.makeBox(60, 40, 4)
part = part.cut(Part.makeCylinder(3.25, 4, V(12, 28, 0)))
# ... the rest of it, placed as the drawing places it

os.makedirs("/app", exist_ok=True)
doc = FreeCAD.newDocument("part")
doc.addObject("Part::Feature", "Part").Shape = part
doc.recompute()
doc.saveAs("/app/part.FCStd")
`,Lt=`"""Grade the board the agent saved and write /out/reward.json.

The board as handed over is in /tests/given (the grader's image copies environment/data there),
with its project file, so KiCad's DRC runs with the rules the author shipped, not with whatever
the agent left in its own copy. What else is checked comes from rules.json:

    {"nets": {"VBAT": {"min_width": 1.0, "layers": ["F.Cu"], "vias": false}},
     "pads": {"D3.1": "VCC", "D3.2": "MOTORN"},
     "planes": [{"layer": "B.Cu", "net": "GND", "under": ["GATE"], "margin": 0.5}],
     "movable": ["X1", "C2"],
     "near": [{"check": "oscillator", "pad": "X1.1", "to": ["U3.20"], "within": 12}],
     "keep_tracks": false,
     "must": ["routed", "untouched", "pads"]}

\`nets\` holds each named net to a minimum track width, a set of copper layers and, with
"vias": false, no vias. \`pads\` says which net a pad must end up on, as reference.pad. \`planes\` says which tracks
need an unbroken plane under them: every point of a track on \`under\`, out to its edge plus
\`margin\` mm, has the filled \`net\` pour of \`layer\` beneath it (round a pad, where the pour always
keeps clear, it is not asked). \`movable\` names parts the agent is to place, which may move; \`near\`
holds a pad of one to within \`within\` mm of the nearest of the \`to\` pads, and the entries
sharing a \`check\` name pass or fail together. \`keep_tracks\`
true means every track and via already on the board stays as it was; false lets the agent reroute
what is there. Parts and the outline never move.

A schematic handed over with the board (named as it is, board.kicad_sch, and its sheets) is what the board must match:
DRC then checks the board against it too, and the board passes \`parity\` with nothing reported, as
KiCad reports all of it as warnings. The grader's copy is the one handed over, not one the agent
saved. A kind of mismatch the project does not care about is set to ignore in the .kicad_pro.

With "edit_schematic": true the agent may change the schematic too: its own saved sheets, beside its
board, take the place of the ones handed over (a sheet it deleted is gone; the .kicad_pro is still
the one handed over, with the author's severities), so \`parity\` holds its board to its schematic, and
\`erc\` is KiCad's electrical rules check on that schematic with no error. \`untouched\` then still holds
every part handed over, but lets the agent add one the schematic calls for; a part the fix is to
remove goes in \`movable\`. The copper already there must stay, by where it is and not by its net's
name, which Update PCB from Schematic renames when the fix joins two nets; copper may be added. A net
in \`nets\` is named as the fixed schematic names it. Without its schematic beside its board, as when
the task's answer is the board alone and not the project folder, the agent's answer scores 0.
A kind of ERC error the project does not care about is set to ignore in the .kicad_pro, as for parity.
What the schematic must say is in pins, as reference.pin, not in net names, which KiCad makes up
from them and changes as the schematic does:

    {"edit_schematic": true,
     "connected": [["R2.1", "U1.3"]],
     "apart": [["R2.1", "U1.8"]]}

\`connected\` holds each group of pins on one net, \`apart\` each group on as many nets as it has pins.
Both need "edit_schematic": a schematic the agent cannot change says the same of every answer; where
the board is the answer, \`pads\` says which net a pad is on.

A board that fails a check in \`must\` (unconnected, a part moved, or not matching its schematic, unless it says otherwise) scores
0; otherwise each check is an equal share. With "edit_schematic", \`erc\`, \`connected\` and \`apart\` are in
\`must\` too: they are the fix.
"""
import glob
import json
import os
import re
import shutil
import subprocess
import tempfile
from collections import Counter

GIVEN = glob.glob("/tests/given/*.kicad_pcb")[0]
NAME = os.path.basename(GIVEN)
RULES = json.load(open("/tests/rules.json"))
NETS = RULES.get("nets", {})
# the schematic KiCad checks the board against is the one named as the board is; any other, it does not find
SCHEMATIC = os.path.exists(f"/tests/given/{os.path.splitext(NAME)[0]}.kicad_sch")
EDIT = RULES.get("edit_schematic", False)
# a board that does not match the schematic it was handed has not done the job, whatever \`must\` names;
# nor, where the schematic is the agent's to fix, one whose schematic is not fixed
MUST = RULES.get("must", ["routed", "untouched"])
MUST = [*MUST, *(k for k in ["parity", *(["erc", "connected", "apart"] if EDIT else [])] if SCHEMATIC and k not in MUST)]


def blocks(text, head):
    """Each top-level \`(head ...)\` block, as text: one tab in, closed where its parentheses balance."""
    out, i = [], 0
    key = f"\\n\\t({head}"
    while (i := text.find(key, i)) >= 0:
        depth, j = 0, i + 2
        while True:
            depth += {"(": 1, ")": -1}.get(text[j], 0)
            j += 1
            if depth == 0:
                break
        out.append(text[i + 2:j])
        i = j
    return out


def net_of(b):
    m = re.search(r'\\(net "([^"]*)"\\)', b)
    return m and m.group(1)


def strip_uuid(b):
    return re.sub(r'\\s*\\(uuid "[^"]*"\\)', "", b)


def fixed(text, refs=None):
    """What the agent may not change: every part (of \`refs\`, if given) with its place, the outline, and with keep_tracks the copper."""
    movable = set(RULES.get("movable", []))
    fps = sorted(re.sub(r"\\s+", " ", strip_uuid(re.split(r"\\n\\t\\t\\(pad ", b)[0])) for b in blocks(text, "footprint")
                 if ref(b) not in movable and (refs is None or ref(b) in refs))
    outline = sorted(strip_uuid(b) for b in blocks(text, "gr_") if "Edge.Cuts" in b)
    copper = (sorted(re.sub(r'\\s*\\(net "[^"]*"\\)', "", strip_uuid(b)) if EDIT else strip_uuid(b)
                     for b in blocks(text, "segment") + blocks(text, "via") if net_of(b) not in NETS)
              if RULES.get("keep_tracks", True) else [])
    return fps, outline, copper


def ref(b):
    return re.search(r'\\(property "Reference" "([^"]*)"', b).group(1)


def pad_nets(text):
    """reference.pad -> the net that pad is on."""
    out = {}
    for b in blocks(text, "footprint"):
        r = ref(b)
        for pad in b.split("\\n\\t\\t(pad ")[1:]:
            net = re.search(r'\\(net "([^"]*)"\\)', pad)
            out[f"{r}.{pad.split()[0].strip(chr(34))}"] = net and net.group(1)
    return out


def plane_gaps(path, plane, step=0.25):
    """Points along the \`under\` tracks with no \`net\` copper on \`layer\` beneath them, after a refill."""
    import math

    import pcbnew

    b = pcbnew.LoadBoard(path)
    pcbnew.ZONE_FILLER(b).Fill(b.Zones())
    layer = b.GetLayerID(plane["layer"])
    poly = pcbnew.SHAPE_POLY_SET()
    for z in b.Zones():
        if z.GetNetname() == plane["net"] and z.IsOnLayer(layer):
            poly.BooleanAdd(z.GetFilledPolysList(layer))
    pads = [(p.GetPosition(), max(p.GetSize().x, p.GetSize().y) / 2 + pcbnew.FromMM(1.0))
            for f in b.GetFootprints() for p in f.Pads()]
    gaps = []
    for t in b.GetTracks():
        if t.GetClass() != "PCB_TRACK" or t.GetNetname() not in plane["under"] or t.GetLayer() == layer:
            continue
        a, c = t.GetStart(), t.GetEnd()
        length = math.hypot(c.x - a.x, c.y - a.y)
        if not length:
            continue
        ux, uy = (c.x - a.x) / length, (c.y - a.y) / length
        off = t.GetWidth() / 2 + pcbnew.FromMM(plane.get("margin", 0.5))
        n = max(1, int(length / pcbnew.FromMM(step)))
        for k in range(n + 1):
            x, y = a.x + ux * length * k / n, a.y + uy * length * k / n
            if any(math.hypot(x - q.x, y - q.y) < r for q, r in pads):
                continue
            if not all(poly.Contains(pcbnew.VECTOR2I(int(x - uy * off * s), int(y + ux * off * s))) for s in (-1, 0, 1)):
                gaps.append((t.GetNetname(), round(pcbnew.ToMM(int(x)), 2), round(pcbnew.ToMM(int(y)), 2)))
    return gaps


def near_misses(path):
    """Each \`near\` entry with how far its pad is from the nearest of its \`to\` pads, in mm, where too far."""
    import math

    import pcbnew

    b = pcbnew.LoadBoard(path)

    def at(ref_pad):
        ref, num = ref_pad.rsplit(".", 1)
        f = b.FindFootprintByReference(ref)
        p = f and next((p for p in f.Pads() if p.GetNumber() == num), None)
        return p and p.GetPosition()

    out = []
    for e in RULES["near"]:
        a = at(e["pad"])
        ds = [math.hypot(a.x - q.x, a.y - q.y) for q in map(at, e["to"]) if q is not None] if a is not None else []
        d = round(pcbnew.ToMM(int(min(ds))), 2) if ds else None
        out.append({**e, "mm": d, "ok": d is not None and d <= e["within"]})
    return out


def sch_nets(path):
    """reference.pin -> the net it is on, in the schematic's netlist as KiCad exports it."""
    out = {}
    for net in re.split(r"\\(net\\s+\\(code\\b", open(path).read())[1:]:
        name = re.search(r'\\(name "([^"]*)"\\)', net).group(1)
        for r_, pin in re.findall(r'\\(ref "([^"]*)"\\)\\s*\\(pin "([^"]*)"\\)', net):
            out[f"{r_}.{pin}"] = name
    return out


def answer():
    found = [p for p in glob.glob("/app/**/" + NAME, recursive=True)]
    return found[0] if found else None


out = {"reward": 0.0, "strict_pass": False, "failure_category": "wrong_answer", "counters": {}, "info": {}}
path = answer()
if path is None:
    out["info"] = {"reason": f"no {NAME} under /app"}
else:
    board = open(path).read()
    with tempfile.TemporaryDirectory() as d, tempfile.TemporaryDirectory() as o:
        # the project as handed over (its rules, its library tables, every sheet of its schematic), not
        # whatever else the author's folder held (backups, autosaves, a report), with the agent's board in it
        for f in glob.glob("/tests/given/**/*", recursive=True):
            # where the agent edits the schematic, its sheets, all of them, are the schematic
            if os.path.isfile(f) and (f.endswith((".kicad_pro", ".kicad_dru", *(() if EDIT else (".kicad_sch",))))
                                      or os.path.basename(f) in ("sym-lib-table", "fp-lib-table")):
                os.makedirs(os.path.dirname(f"{d}/{os.path.relpath(f, '/tests/given')}"), exist_ok=True)
                shutil.copy(f, f"{d}/{os.path.relpath(f, '/tests/given')}")
        shutil.copy(path, f"{d}/{NAME}")
        saved = []
        if EDIT:
            # the sheets the agent saved over those handed over; not KiCad's own backups, in a hidden folder
            here = os.path.dirname(path)
            for s in glob.glob(f"{here}/**/*.kicad_sch", recursive=True):
                saved.append(s)
                rel = os.path.relpath(s, here)
                os.makedirs(os.path.dirname(f"{d}/{rel}"), exist_ok=True)
                shutil.copy(s, f"{d}/{rel}")
        # with no schematic beside the board, KiCad reports no mismatch rather than none to check against
        r = subprocess.run(["kicad-cli", "pcb", "drc", "--refill-zones", *(["--schematic-parity"] if SCHEMATIC else []),
                            "--format", "json", "-o", f"{o}/drc.json", f"{d}/{NAME}"], capture_output=True, text=True, timeout=300)
        # written outside the project's copy, so no report the author left there is read as this one
        drc = json.load(open(f"{o}/drc.json")) if os.path.exists(f"{o}/drc.json") else None
        root = f"{d}/{os.path.splitext(NAME)[0]}.kicad_sch"
        pins = erc = None
        if SCHEMATIC and EDIT and (RULES.get("connected") or RULES.get("apart")):
            n = subprocess.run(["kicad-cli", "sch", "export", "netlist", "-o", f"{o}/sch.net", root], capture_output=True, timeout=300)
            pins = sch_nets(f"{o}/sch.net") if n.returncode == 0 and os.path.exists(f"{o}/sch.net") else None
        if SCHEMATIC and EDIT:
            subprocess.run(["kicad-cli", "sch", "erc", "--format", "json", "-o", f"{o}/erc.json", root], capture_output=True, timeout=300)
            try:
                erc = [v for s in json.load(open(f"{o}/erc.json"))["sheets"] for v in s["violations"] if v["severity"] == "error"]
            except (OSError, ValueError, KeyError, TypeError):
                erc = None
    if EDIT and SCHEMATIC and not saved:
        out["info"] = {"reason": f"no schematic beside {NAME} in the answer: where the agent may edit the schematic, "
                                 "the answer is the project folder, /app/data/, not the board alone"}
    elif drc is None:
        out["info"] = {"reason": "KiCad could not read the board" + (" or its schematic" if SCHEMATIC else ""), "log": (r.stdout + r.stderr)[-1500:]}
    else:
        errors = [v for v in drc["violations"] if v["severity"] == "error"]
        tracks = [b for b in blocks(board, "segment") if net_of(b) in NETS]
        vias = [b for b in blocks(board, "via") if net_of(b) in NETS]
        given = open(GIVEN).read()
        # editing the schematic may add parts, not take away those handed over (unless movable)
        kept = {ref(b) for b in blocks(given, "footprint")} if EDIT else None
        was, now = fixed(given, kept), fixed(board, kept)
        # an edit may add copper the fix calls for, not take away what is there
        copper = not Counter(was[2]) - Counter(now[2]) if EDIT else was[2] == now[2]
        checks = {
            "routed": len(drc["unconnected_items"]) == 0,
            "drc_clean": len(errors) == 0,
            "untouched": was[:2] == now[:2] and copper,
        }
        # what a failed check found, said so a reader of the run need not open the board
        missed = {
            "routed": f"{len(drc['unconnected_items'])} unconnected item(s) left.",
            "drc_clean": f"{len(errors)} DRC error(s): " + ", ".join(sorted({v["type"] for v in errors})) + ".",
            "untouched": "; ".join(
                # counted, not as sets: a part the agent added a copy of is changed too
                ([f"moved, changed or removed: {', '.join(sorted({ref(b) for b in (Counter(was[0]) - Counter(now[0])) + (Counter(now[0]) - Counter(was[0]))}))}"]
                 if was[0] != now[0] else [])
                + (["the outline changed"] if was[1] != now[1] else [])
                + ([f"copper already there {'removed or moved' if EDIT else 'changed'}"] if not copper else [])) + ".",
        }
        notes = {
            "routed": "Every pad that should be connected is: KiCad finds no unconnected items.",
            "drc_clean": "KiCad's design rule check, with the project's own rules, finds no errors.",
            "untouched": ("Every part on both boards" if EDIT else "Every part") + " and the outline are where they were"
                         + (", and so is the copper already there." if RULES.get("keep_tracks", True) else "."),
        }
        if SCHEMATIC:
            parity = drc["schematic_parity"]
            checks["parity"] = not parity
            notes["parity"] = "The board matches its schematic: KiCad finds no difference between them."
            missed["parity"] = f"{len(parity)} difference(s) from the schematic: " + "; ".join(
                v.get("description", v["type"]) for v in parity[:5]) + ("; …" if len(parity) > 5 else "") + "."
        if SCHEMATIC and EDIT:
            checks["erc"] = erc == []
            notes["erc"] = "KiCad's electrical rules check finds no error in the schematic."
            missed["erc"] = ("KiCad could not check the schematic." if erc is None else
                             f"{len(erc)} ERC error(s): " + "; ".join(v.get("description", v["type"]) for v in erc[:5]) + ("; …" if len(erc) > 5 else "") + ".")
        for kind, want in (("connected", True), ("apart", False)):
            for group in RULES.get(kind, []) if SCHEMATIC and EDIT else []:
                on = [(pins or {}).get(p) for p in group]
                # a pin on no net is a part the schematic no longer has, which keeps nothing apart either
                ok = pins is not None and None not in on and len(set(on)) == (1 if want else len(on))
                checks[kind] = checks.get(kind, True) and ok
                notes[kind] = notes.get(kind, "In the schematic, " + ("on one net: " if want else "on separate nets: ")) + " with ".join(group) + "; "
                if not ok:
                    missed[kind] = missed.get(kind, "") + ("KiCad could not export the schematic's netlist; " if pins is None else
                                                           ", ".join(f"{p} is on {pins.get(p) or 'no net'}" for p in group) + "; ")
        if any("min_width" in r_ for r_ in NETS.values()):
            def wide(b):
                w = float(re.search(r"\\(width ([\\d.]+)\\)", b).group(1))
                return w >= NETS[net_of(b)].get("min_width", 0) - 1e-6
            on = {n for n, r_ in NETS.items() if "min_width" in r_}
            checks["widths"] = all(any(net_of(b) == n for b in tracks) for n in on) and all(wide(b) for b in tracks)
            missed["widths"] = "; ".join(
                f"{n}: no track" if not ws else f"{n}: narrowest {min(ws)} mm, needs {NETS[n]['min_width']} mm"
                for n in sorted(on)
                for ws in [[float(w) for b in tracks if net_of(b) == n for w in re.findall(r"\\(width ([\\d.]+)\\)", b)]]
                if not ws or min(ws) < NETS[n]["min_width"] - 1e-6) + "."
            notes["widths"] = "Every track on " + ", ".join(sorted(on)) + " is at least as wide as it has to be."
        if any("layers" in r_ or r_.get("vias") is False for r_ in NETS.values()):
            def placed(b):
                layers = NETS[net_of(b)].get("layers")
                return not layers or re.search(r'\\(layer "([^"]+)"\\)', b).group(1) in layers
            checks["layers"] = all(placed(b) for b in tracks) and not any(NETS[net_of(v)].get("vias") is False for v in vias)
            notes["layers"] = "The named nets stay on their layers, and those that may not have vias have none."
            missed["layers"] = "; ".join(
                [f"{n} has a track on {l}" for n, l in sorted({(net_of(b), re.search(r'\\(layer "([^"]+)"\\)', b).group(1))
                                                             for b in tracks if not placed(b)})]
                + [f"{n} has a via" for n in sorted({net_of(v) for v in vias if NETS[net_of(v)].get("vias") is False})]) + "."
        if RULES.get("pads"):
            on = pad_nets(board)
            checks["pads"] = all(on.get(p) == n for p, n in RULES["pads"].items())
            notes["pads"] = "Each of " + ", ".join(sorted(RULES["pads"])) + " is on the net it has to be."
            missed["pads"] = "; ".join(f"{p} is on {on.get(p) or 'no net'}, needs {n}"
                                       for p, n in sorted(RULES["pads"].items()) if on.get(p) != n) + "."
        if RULES.get("planes"):
            gaps = [g for plane in RULES["planes"] for g in plane_gaps(path, plane)]
            checks["planes"] = not gaps
            notes["planes"] = "Under " + ", ".join(sorted({n for p in RULES["planes"] for n in p["under"]})) + " the plane is whole."
            missed["planes"] = gaps and f"{len(gaps)} point(s) with no plane beneath, the first on {gaps[0][0]} at ({gaps[0][1]}, {gaps[0][2]}) mm."
        if RULES.get("near"):
            near = near_misses(path)
            for e in near:
                checks[e["check"]] = checks.get(e["check"], True) and e["ok"]
                notes[e["check"]] = notes.get(e["check"], "Placed where it works: ") + f"{e['pad']} within {e['within']} mm of {' or '.join(e['to'])}; "
                if not e["ok"]:
                    missed[e["check"]] = missed.get(e["check"], "") + (
                        f"{e['pad']} is {e['mm']} mm from {' or '.join(e['to'])}, needs {e['within']} mm or less; " if e["mm"] is not None
                        else f"{e['pad']} or {' / '.join(e['to'])} is not on the board; ")
        failed = sorted(k for k, ok in checks.items() if not ok)
        # a board that fails what the task is for (unconnected, parts moved, by default) has not done the job at all
        reward = sum(checks.values()) / len(checks) if all(checks.get(k, True) for k in MUST) else 0.0
        out.update(reward=round(reward, 3), strict_pass=not failed, failure_category=None if not failed else "wrong_answer")
        out["counters"] = {"unconnected": len(drc["unconnected_items"]), "drc_errors": len(errors),
                           **({"parity": len(drc["schematic_parity"])} if SCHEMATIC else {}),
                           **{f"min_width_{n}": min([float(w) for b in tracks if net_of(b) == n
                                                     for w in re.findall(r"\\(width ([\\d.]+)\\)", b)] or [0.0])
                              for n in NETS}}
        out["info"] = {"checks": sorted(checks), "failed": failed, "check_notes": {k: notes[k].rstrip("; ") for k in checks},
                       "missed": {k: missed[k].rstrip("; ") for k in failed}, "must": [k for k in MUST if k in checks],
                       **({"plane_gaps": gaps[:20]} if RULES.get("planes") else {}),
                       **({"near": [{k: e[k] for k in ("pad", "to", "within", "mm")} for e in near]} if RULES.get("near") else {}),
                       "drc_errors": sorted({v["type"] for v in errors})}

os.makedirs("/out", exist_ok=True)
json.dump(out, open("/out/reward.json", "w"), indent=2)
print(json.dumps(out))
`,Rt=`{
  "nets": {},
  "keep_tracks": true
}
`,zt=`# The withheld half, for a KiCad task: the same KiCad, the grader, and the board and project as
# handed over, which nothing may move from and whose rules DRC runs with.
FROM kicad/kicad:10.0.6@sha256:18693567392b80da435f9fa952ce3a3e534c66eb5a6033f5b9c80aa3b19dd3ec
USER root
COPY verifier/ /tests/
COPY environment/data/ /tests/given/
RUN mkdir -p /app /out
`,Bt={"verifier/report.py":Lt,"verifier/rules.json":Rt},Vt=`"""The correct answer: the board as handed over, edited in place with KiCad's own Python."""
import pcbnew

PATH = "/app/data/board.kicad_pcb"
board = pcbnew.LoadBoard(PATH)


def track(net, a, b, width, layer=pcbnew.F_Cu):
    t = pcbnew.PCB_TRACK(board)
    t.SetStart(pcbnew.VECTOR2I(pcbnew.FromMM(a[0]), pcbnew.FromMM(a[1])))
    t.SetEnd(pcbnew.VECTOR2I(pcbnew.FromMM(b[0]), pcbnew.FromMM(b[1])))
    t.SetWidth(pcbnew.FromMM(width))
    t.SetLayer(layer)
    t.SetNet(board.FindNet(net))
    board.Add(t)


track("VBAT", (25, 25), (42, 25), 1.0)
# ...

pcbnew.ZONE_FILLER(board).Fill(board.Zones())
pcbnew.SaveBoard(PATH, board)

# A fix that changes the schematic is made in KiCad and uploaded beside this file
# (gold.kicad_sch, gold.kicad_pcb); this file then only puts the project in place:
#
#     import shutil
#     shutil.copy("/solution/gold.kicad_sch", "/app/data/board.kicad_sch")
#     shutil.copy("/solution/gold.kicad_pcb", "/app/data/board.kicad_pcb")
`,Ht=`"""Grade the RTL the agent saved against the withheld testbenches and write /out/reward.json.

What runs comes from /tests/rtl.json:

    {"module": "fifo", "dut": ["/app/data/fifo.v"],
     "benches": [{"top": "tb", "files": ["tb_hidden.v"], "params": {"DEPTH": 4}, "tb_params": {"SEED": 1},
                  "checks": ["fill_to_depth", "random_traffic"]}]}

\`dut\` is the RTL the agent edits, the task's artifacts, and \`module\` its top. Each bench is compiled
with it by Icarus Verilog and by Verilator, and run once on Icarus and on Verilator at SEEDS seeds,
every flop and memory powering up random. \`params\` are the design's parameters: the bench gets them
and passes them down, and the design is also elaborated alone with them. \`tb_params\` are the bench's own.

Every run gets +nonce=<random> and +seed=<random>, the stimulus seed the bench should read, so no
design can learn the traffic. A bench has to print, for each check, \`CHECK <nonce> <name> PASS\` or
\`CHECK <nonce> <name> FAIL <why>\`, then \`DONE <nonce>\` before it ends. Only lines with the nonce,
before DONE, count. A check passes when every run of every bench naming it printed PASS: one a run
never reached, or a run that never printed DONE, has failed. So a design that reads its own power-up
state, or adapts to what the bench does first, fails on the seeds where that guess is wrong.

\`must\` names the checks the design as handed over already passes, what the change must not break: one
failing scores 0, and they pay nothing, so the untouched design scores 0.

A build or run that is killed, by a signal or the clock, fails its checks: nothing a design can cause
counts as the grader's fault, or a design could crash its way out of a score.

Before any bench, the RTL has to be synthesizable RTL that cannot touch a bench (\`lint\`): no compiler
directive but \`timescale and \`default_nettype, so no macro hides what follows; no system task but
$signed, $unsigned and $clog2, so it cannot print or end a run; no hierarchical name, escaped
identifier, bind, defparam, import or export, so it names nothing outside itself and calls no C; no \`initial\`, no delay, no force, no wait, fork or unbounded loop, and every event control is @* or
edges only.
And it elaborates alone at each bench's \`params\` (\`elaborates\`). Failing either scores 0; otherwise
the reward is the share of the benches' checks outside \`must\` that pass.

The root of every path is argv[1] when given, so the grader runs outside its image too.
"""
import json
import os
import re
import secrets
import subprocess
import sys
import tempfile

ROOT = sys.argv[1] if len(sys.argv) > 1 else "/"
TESTS = os.path.join(ROOT, "tests")
SPEC = json.load(open(os.path.join(TESTS, "rtl.json")))
DUT = [os.path.join(ROOT, p.lstrip("/")) for p in SPEC["dut"]]
OUT = os.path.join(ROOT, "out", "reward.json")
RUN_S = 300
SEEDS = 16
MUST = SPEC.get("must", [])

TASKS_OK = {"$signed", "$unsigned", "$clog2"}
DIRECTIVES_OK = {"timescale", "default_nettype"}
# the two places \`#(\` is a parameter list, not a delay: a module's header, and named overrides on an instance
PARAM_LISTS = r"\\bmodule\\s+[A-Za-z_]\\w*\\s*#\\s*\\(|#\\s*\\(\\s*\\."
EDGES = r"\\(\\s*(posedge|negedge)\\s+[A-Za-z_]\\w*(\\s*(or|,)\\s*(posedge|negedge)\\s+[A-Za-z_]\\w*)*\\s*\\)"
BANNED = [
    (r"\\binitial\\b", "an initial block"),
    (r"\\b(force|release|deassign)\\b", "force or release"),
    (r"\\b(defparam|bind)\\b", "a defparam or bind"),
    (r"\\b(import|export)\\b", "an import or export, DPI or a package"),
    (r"\\b(wait|fork|forever|while|event)\\b|->", "a wait, fork, unbounded loop or event"),
    (r"\\\\", "an escaped identifier"),
    (r"[\\w$\\]]\\s*\\.\\s*[A-Za-z_$]", "a hierarchical name"),
    (r"\\bprimitive\\b", "a user-defined primitive"),
]


def code(path):
    """The source without its comments, strings blanked."""
    text = open(path, errors="replace").read()
    return re.sub(r'//[^\\n]*|/\\*.*?\\*/|"(?:\\\\.|[^"\\\\])*"', " ", text, flags=re.S)


def lint():
    found = []
    for path in DUT:
        src, name = code(path), os.path.basename(path)
        found += [f"{name} uses \`{d}" for d in sorted(set(re.findall(r"\`\\s*(\\w*)", src)) - DIRECTIVES_OK)]
        found += [f"{name} calls {t}" for t in sorted(set(re.findall(r"\\$[\\w$]*", src)) - TASKS_OK)]
        found += [f"{name} has {why}" for pat, why in BANNED if re.search(pat, src)]
        if "#" in re.sub(PARAM_LISTS, " ", src):
            found.append(f"{name} has a delay")
        found += [f"{name} has @{' '.join(ev.split())}, not @* or a list of posedge and negedge" for ev in re.findall(r"@\\s*(\\([^)]*\\)|\\*|[A-Za-z_]\\w*)", src)
                  if re.sub(r"\\s", "", ev) not in ("*", "(*)") and not re.fullmatch(EDGES, ev)]
        found += [f"{name} has an event control that does not open an always block" for opener in re.findall(r"(\\balways(?:_ff|_comb|_latch)?\\s*)?@", src) if not opener]
        decl = re.sub(r"\\b(?:localparam|parameter)\\b[^;)]*|\\bfor\\s*\\([^;]*;", " ", src)
        if re.search(r"\\b(reg|logic|bit|integer|int|byte|shortint|longint|time|real|realtime|var)\\b(?:[^;=\\[{]|\\[[^\\]]*\\])*=", decl):
            found.append(f"{name} has a register given its power-up value where it is declared")
        found += [f"{name} clocks on both edges of {sig}" for ev in re.findall(r"@\\s*(\\([^)]*\\))", src)
                  for e in [re.findall(r"edge\\s+(\\w+)", ev)] for sig in set(e) if e.count(sig) > 1]
    return found


def compile_(out, files, top, params):
    argv = ["iverilog", "-g2012", "-o", out, "-s", top] + [f"-P{top}.{k}={v}" for k, v in params.items()]
    r = subprocess.run(argv + files, capture_output=True, text=True)
    return r.returncode == 0, (r.stdout + r.stderr).strip()


def run(argv):
    """{check: (passed, why)} for the checks one run printed, or why it has none."""
    nonce, seed = secrets.token_hex(8), secrets.randbelow(2**31)
    try:
        r = subprocess.run(argv + [f"+nonce={nonce}", f"+seed={seed}"], capture_output=True, text=True, timeout=RUN_S)
    except subprocess.TimeoutExpired:
        return {}, f"+seed={seed} ran past {RUN_S} s"
    if r.returncode < 0:
        return {}, f"+seed={seed}: killed by signal {-r.returncode}"
    # a string in a wide reg prints padded with spaces or NULs, depending on the format and Icarus's version
    lines = [" ".join(line.replace("\\0", " ").split()) for line in r.stdout.splitlines()]
    if f"DONE {nonce}" not in lines:
        return {}, f"+seed={seed}: the bench did not finish: it hung, or something ended it first"
    got = {}
    for line in lines[:lines.index(f"DONE {nonce}")]:
        m = re.match(rf"CHECK {nonce} (\\S+) (PASS|FAIL) ?(.*)$", line)
        if m and got.get(m.group(1), (True,))[0]:
            got[m.group(1)] = (m.group(2) == "PASS", f"+seed={seed}: {m.group(3).strip()}")
    return got, None


def bench(b, work):
    """{check: (passed, why)} for each check this bench names, over every run of it."""
    files, params, top = DUT + [os.path.join(TESTS, f) for f in b["files"]], {**b["params"], **b["tb_params"]}, b["top"]
    obj = tempfile.mkdtemp(dir=work)
    ok, said = compile_(os.path.join(obj, "sim.vvp"), files, top, params)
    if not ok:
        return {n: (False, f"does not compile with {top}: {said[-1500:]}") for n in b["checks"]}
    r = subprocess.run(["verilator", "--binary", "--timing", "-j", "2", "-Wno-fatal", "-Wno-lint", "-Wno-style",
                        "--timescale", "1ns/1ps", "--x-initial", "unique", "--x-assign", "unique", "--top-module", top, "-Mdir", obj, "-o", "vsim"]
                       + [f"-G{k}={v}" for k, v in params.items()] + files, capture_output=True, text=True)
    if r.returncode:
        return {n: (False, f"does not build in Verilator with {top} (exit {r.returncode}): {(r.stdout + r.stderr)[-1500:]}") for n in b["checks"]}
    runs = [("Icarus", ["vvp", "-n", os.path.join(obj, "sim.vvp")])] + [
        (f"Verilator power-up seed {s}", [os.path.join(obj, "vsim"), f"+verilator+seed+{s}", "+verilator+rand+reset+2"])
        for s in range(1, SEEDS + 1)]
    got = {n: (True, "") for n in b["checks"]}
    for label, argv in runs:
        printed, broke = run(argv)
        for n in b["checks"]:
            passed, why = printed.get(n, (False, broke or "never reported"))
            if not passed and got[n][0]:
                got[n] = (False, f"{label}, {why}")
    return got


out = {"reward": 0.0, "strict_pass": False, "failure_category": "build_failed", "counters": {}, "info": {}}
checks, missed = {}, {}
work = tempfile.mkdtemp(prefix="rtl-")
missing = [p for p in DUT if not os.path.isfile(p)]
problems = lint() if not missing else [f"{p} is missing" for p in missing]
checks["lint"] = not problems
if problems:
    missed["lint"] = "; ".join(problems)
checks["elaborates"] = not missing
if missing:
    missed["elaborates"] = "not run: a design file is missing"
for params in ([] if missing else list({json.dumps(b["params"], sort_keys=True): b["params"] for b in SPEC["benches"]}.values())):
    ok, said = compile_(os.path.join(work, "dut.vvp"), DUT, SPEC["module"], params)
    if not ok and checks["elaborates"]:
        checks["elaborates"], missed["elaborates"] = False, f"at {json.dumps(params)}: {said[-1500:]}"

names = list(dict.fromkeys(n for b in SPEC["benches"] for n in b["checks"]))
for n in names:
    checks[n] = True
if checks["lint"] and checks["elaborates"]:
    for b in SPEC["benches"]:
        got = bench(b, work)
        where = f"{b['top']} {json.dumps({**b['params'], **b['tb_params']})}"
        for n in b["checks"]:
            passed, why = got[n]
            if not passed and checks[n]:
                checks[n], missed[n] = False, f"{where}: {why}"
    failed = sorted(k for k, v in checks.items() if not v)
    paying = [n for n in names if n not in MUST]
    reward = 0 if not all(checks[n] for n in MUST) else sum(checks[n] for n in paying) / len(paying)
    out.update(reward=round(reward, 3), strict_pass=not failed,
               failure_category=None if not failed else "tests_failed")
else:
    for n in names:
        checks[n], missed[n] = False, "not run: the RTL failed lint or does not elaborate"
    failed = sorted(k for k, v in checks.items() if not v)

out["counters"] = {"checks_passed": sum(checks.values()), "checks": len(checks)}
out["info"] = {"checks": sorted(checks), "failed": failed, "missed": {k: missed[k] for k in failed},
               "must": ["lint", "elaborates", *MUST]}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(out, open(OUT, "w"), indent=2)
print(json.dumps(out))
`,Ut=`{
  "module": "design",
  "dut": ["/app/data/design.v"],
  "benches": [
    {"top": "tb", "files": ["tb_hidden.v"], "params": {}, "tb_params": {}, "checks": ["basic"]}
  ]
}
`,Wt=`# The withheld half, for an RTL task: Icarus Verilog and Verilator, the grader, rtl.json and your
# testbenches. Only the design the agent saved crosses.
FROM RTL_IMAGE
RUN apt-get update && apt-get install -y --no-install-recommends RTL_PACKAGES && rm -rf /var/lib/apt/lists/*
COPY verifier/ /tests/
RUN mkdir -p /app/data /out
`,Gt=`iverilog verilator g++ make python3`,Kt=e=>a(Wt.replace(`RTL_IMAGE`,e).replace(`RTL_PACKAGES`,Gt)),qt=`cd data && make -s; gtkwave waves.gtkw & mousepad *.v sim.log & while sleep 2; do make -s; done`,Jt={"verifier/report.py":Ht,"verifier/rtl.json":Ut},Yt=`"""The fixed design, written where the agent saves it."""
open("/app/data/design.v", "w").write(r'''
module design (
    input wire clk,
    // ...
);
    // ... the design as handed over, with the bug fixed
endmodule
''')
`,Xt=[{path:`agent/PROMPT.md`,purpose:`The prompt, as the engineer would have received it`,by:`you`},{path:`environment/Dockerfile`,purpose:`The container the agent works in: your tools, your data`,by:`generated`},{path:`environment/data/`,purpose:`The material the agent investigates`,by:`you`},{path:`references/gold.py`,purpose:`Your correct answer. It has to score 1.00`,by:`you`,withheld:!0},{path:`references/naive_a.py`,purpose:`The wrong answer a competent colleague would give`,by:`you`,withheld:!0},{path:`verifier/test_outputs.py`,purpose:`One check per thing you are checking`,by:`generated`,withheld:!0},{path:`verifier/report.py`,purpose:`Turns those checks into one number`,by:`generated`,withheld:!0},{path:`verifier/Dockerfile`,purpose:`The withheld half: the tests, and nothing else`,by:`generated`,withheld:!0},{path:`task.json`,purpose:`What runs, with what, and what crosses`,by:`generated`},{path:`/app/answer.txt`,purpose:"Where the agent writes its answer, one `Label: value` per line",by:`agent`}],Zt=a(`# The withheld half, for a C task: the checks compile the solution against
# harness.c, so this has a compiler as well as pytest. Copies only verifier/.
FROM python:3.12-slim-bookworm@sha256:782412e85d0f0984994c290652577d4018aff08145c85b262bb63dc0c7522254

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends gcc libc6-dev && rm -rf /var/lib/apt/lists/*
${i(`pytest==9.1.1 pytest-json-ctrf==0.5.2`)}

COPY verifier/ /tests/

RUN mkdir -p /app /out
`),Qt=[`xvfb`,`xfce4`,`xfce4-terminal`,`x11vnc`,`novnc`,`dbus-x11`,`libx11-6`,`libxrandr2`,`libxext6`,`libxrender1`,`libxfixes3`,`libxss1`,`libxtst6`,`libxi6`],$t=`ghcr.io/talentrator/dop-desktop:bookworm`,en=`A fix that changes the schematic is made in KiCad, not in Python: upload the corrected project here, as gold.kicad_sch and gold.kicad_pcb (and naive_a.kicad_sch, naive_a.kicad_pcb for a common mistake). Your gold.py copies them into /app/data, from /solution.`,tn=e=>{let t=t=>Object.keys(e).filter(e=>/^environment\/data\/[^/]+$/.test(e)&&e.endsWith(t)).map(e=>e.slice(17)),n=t(`.kicad_pcb`),r=n[0]?.slice(0,-10);if(n.length!==1||!(`environment/data/${r}.kicad_pro`in e))return`The grader copies your KiCad project, so the box can be built once its board and project (board.kicad_pcb and board.kicad_pro, one of each, the same name) are added at the top of Environment (3.1): the files themselves, not their folder. A file over 2 MB is kept in /app/files instead, where neither KiCad nor the grader looks.`;let i=t(`.kicad_sch`);if(i.length&&!i.includes(`${r}.kicad_sch`)){let t=new Set(i.flatMap(t=>[...e[`environment/data/${t}`].matchAll(/\(property "Sheetfile" "([^"]+)"/g)].map(e=>e[1])));return`KiCad checks ${r}.kicad_pcb against ${r}.kicad_sch only: rename ${i.find(e=>!t.has(e))??i[0]} to ${r}.kicad_sch (3.1, Environment), or the board is matched against no schematic.`}},nn=`ghcr.io/talentrator/dop-desktop:kicad-10`,H=`ghcr.io/talentrator/dop-desktop:blender-5.2`,U=`ghcr.io/talentrator/dop-desktop:freecad-1.1`,rn=`ghcr.io/talentrator/dop-desktop:rtl-bookworm`,W=`debian:forky-20261005-slim`,an=`ghcr.io/talentrator/dop-desktop:`,G=[{id:`calc`,name:`LibreOffice Calc`,packages:`libreoffice-calc`,desktop:`libreoffice --calc --norestore /app/data/* /app/files/*`},{id:`pulseview`,name:`PulseView (sigrok logic analyser)`,packages:`pulseview`,desktop:`pulseview /app/data/* /app/files/*`}],K=[{id:`bundle`,check:()=>`python3 --version`,name:`Python`,what:`A Docker container from your Dockerfile. The agent gets bash under /app; pytest checks score the result.`,skill:`Requires Python`,kind:`Docker sandbox`,docker:!0,fixture:!1,tools:`bash(command), submit(notes)`,grading:`pytest checks, one per criterion; reward = fraction passed, strict pass = all`,needs:`a model, or a reference answer`,write:[`the prompt, as the engineer would receive it`,`environment/Dockerfile: the software the agent needs`,`gold.py: your correct answer, as a script that writes it`,`naive_a.py, naive_b.py: the plausible wrong answers`,`criteria in task.json, one pytest check behind each`],env:{image:`python:3.12-slim`,packages:``,cpu:1,mem:1,disk:4,timeout:120,steps:40,network:!1,dockerfile_generated:!0},builtin:[],files:Xt,answer:`py`,artifact:`/app/answer.txt`},{id:`constraintbench`,check:()=>`gcc --version | head -1`,name:`C harness with budgets`,what:`A Docker container with gcc. The agent writes /app/solution.c; your hidden harness links it, runs it and prints what it measured, and each budget is a band on one of those numbers.`,skill:`Requires C`,kind:`Docker sandbox`,docker:!0,fixture:!1,tools:`bash(command), submit(notes)`,grading:`one check per budget; reward = fraction within budget, strict pass = all`,needs:`a model, or a reference solution`,write:[`the prompt, as the engineer would receive it`,"verifier/harness.c: calls the solution and prints `metric=value` lines",`gold.c: your correct fix`,`naive_a.c, naive_b.c: the plausible wrong fixes`,`the budgets, one check per metric`],env:{image:`gcc@sha256:fa11eac694e287a37cac7f5078fadf9288b919c9ccbc06dc4df24f7482d2b263`,packages:``,cpu:1,mem:2,disk:4,timeout:600,steps:40,network:!1,dockerfile_generated:!0},builtin:[`C3-077`,`TEST-CRC`],files:[{path:`agent/PROMPT.md`,purpose:`The prompt, as the engineer would have received it`,by:`you`},{path:`environment/Dockerfile`,purpose:`The container the agent works in: gcc, and your data`,by:`generated`},{path:`/app/solution.c`,purpose:`Where the agent writes its fix`,by:`agent`},{path:`verifier/harness.c`,purpose:`Links the solution, runs it, prints metric=value lines`,by:`you`,withheld:!0},{path:`verifier/test_outputs.py`,purpose:`Builds it and holds each metric to its budget`,by:`generated`,withheld:!0},{path:`references/gold.c`,purpose:`Your correct fix`,by:`you`,withheld:!0},{path:`references/naive_a.c`,purpose:`The plausible wrong fix`,by:`you`,withheld:!0}],answer:`c`,artifact:`/app/solution.c`,verifier:()=>Zt,harness:`verifier/harness.c`},{id:`firmware`,check:e=>ve(w(e)).join(`
`),name:`Firmware on QEMU or Renode`,what:`A Docker container with the board's cross compiler and its emulator, QEMU or Renode. The agent writes /app/firmware.c for a Cortex-M board (M0 to M55, STM32 and Renesas RA among them), an Arduino or a RISC-V board with a UART; your hidden driver puts bytes on the UART and prints what came back, and each budget is a band on one of those numbers.`,skill:`Requires C and Python`,kind:`Docker sandbox`,docker:!0,fixture:!1,tools:`bash(command), submit(notes)`,grading:`one check per budget; reward = fraction within budget, strict pass = all`,needs:`a model, or a reference firmware`,write:[`the ticket, as the engineer would receive it`,"verifier/drive.py: runs the built image on the board and prints `metric=value` lines",`gold.c: your correct firmware`,`naive_a.c, naive_b.c: the plausible wrong firmware`,`the budgets, one check per metric`],env:{image:`debian:12-slim`,packages:D(C[0]),cpu:2,mem:2,disk:8,timeout:600,steps:40,network:!1,dockerfile_generated:!0,variant:C[0].id},builtin:[],files:[{path:`agent/PROMPT.md`,purpose:`The prompt, as the engineer would have received it`,by:`you`},{path:`environment/Dockerfile`,purpose:`The container the agent works in: the toolchain, the emulator, and the board files`,by:`generated`},{path:`environment/data/`,purpose:`The board: start.c, link.ld (not on an AVR), board.resc (on Renode), uart.h and run.sh. Under /app/data`,by:`generated`},{path:`/app/firmware.c`,purpose:`Where the agent writes its firmware`,by:`agent`},{path:`verifier/drive.py`,purpose:`Runs the built image on the board and prints metric=value lines`,by:`you`,withheld:!0},{path:`verifier/board.py`,purpose:`The helper drive.py imports: bytes in on the UART, bytes out`,by:`generated`,withheld:!0},{path:`verifier/test_outputs.py`,purpose:`Builds the firmware, runs the driver, and holds each metric to its budget`,by:`generated`,withheld:!0},{path:`references/gold.c`,purpose:`Your correct firmware`,by:`you`,withheld:!0},{path:`references/naive_a.c`,purpose:`The plausible wrong firmware`,by:`you`,withheld:!0}],answer:`c`,artifact:`/app/firmware.c`,verifier:e=>Oe(w(e)),harness:`verifier/drive.py`,variants:{label:`Board`,options:C.map(e=>({id:e.id,name:e.name,group:pe(e),packages:D(e)}))},seed:e=>Ee(w(e)),rig:`board`,example:e=>w(e).echo,driver:()=>De,describe:e=>`Board: ${w(e).name}, ${_e(w(e))}.`,install:e=>ye(w(e)),harnessNote:`Withheld. The firmware is built from the agent's /app/firmware.c and this is run with the image as its one argument. It has board(elf, bytes, expected) to put bytes on the UART, and every line it prints as metric=value is a field a check below can hold to a budget.`},{id:`eclipse`,check:e=>L.find(t=>t.id===e)?.check,name:`Eclipse software`,what:`A Docker container with an Eclipse component installed and ready to start: the Kuksa databroker, the Zenoh router, the Mosquitto MQTT broker, the SUMO traffic simulator, the Velocitas vehicle-app SDK, or one you add. The agent writes /app/solution.py against it; your hidden driver starts the component, runs the program and prints what it measured, and each budget is a band on one of those numbers.`,skill:`Requires Python`,kind:`Docker sandbox`,docker:!0,fixture:!1,tools:`bash(command), submit(notes)`,grading:`one check per budget; reward = fraction within budget, strict pass = all`,needs:`a model, or a reference program`,write:[`the ticket, as the engineer would receive it`,"verifier/drive.py: starts the component, runs the program and prints `metric=value` lines",`gold.py: your correct program`,`naive_a.py, naive_b.py: the plausible wrong programs`,`the budgets, one check per metric`],env:{image:`python:3.12-slim-bookworm`,packages:N(j[0]),cpu:2,mem:2,disk:8,timeout:600,steps:40,network:!1,dockerfile_generated:!0,variant:j[0].id},builtin:[],files:[{path:`agent/PROMPT.md`,purpose:`The prompt, as the engineer would have received it`,by:`you`},{path:`environment/Dockerfile`,purpose:`The container the agent works in: the component and its client library`,by:`generated`},{path:`environment/data/`,purpose:`Its configuration and start.sh, which starts it detached. Under /app/data`,by:`generated`},{path:`/app/solution.py`,purpose:`Where the agent writes its program`,by:`agent`},{path:`verifier/drive.py`,purpose:`Starts the component, runs the program and prints metric=value lines`,by:`you`,withheld:!0},{path:`verifier/stack.py`,purpose:`The helper drive.py imports: start the component, wait for it, stop it`,by:`generated`,withheld:!0},{path:`verifier/test_outputs.py`,purpose:`Runs the driver and holds each metric to its budget`,by:`generated`,withheld:!0},{path:`references/gold.py`,purpose:`Your correct program`,by:`you`,withheld:!0},{path:`references/naive_a.py`,purpose:`The plausible wrong program`,by:`you`,withheld:!0}],answer:`py`,artifact:`/app/solution.py`,harness:`verifier/drive.py`,variants:{label:`Component`,options:j.map(e=>({id:e.id,name:e.name,packages:N(e),artifact:e.artifact,answer:e.answer,harness:e.harness}))},seed:e=>at(M(e),Q(`python:3.12-slim-bookworm`)),install:e=>M(e).install,rig:`stack`,example:e=>M(e).example,driver:e=>M(e).driver,describe:e=>tt(M(e)),harnessNote:`Withheld. The agent's program is checked to build, then this is run with it (for TITAN the harness is a TTCN-3 module, and the given drive.py builds it with the solution). It has running() to start the component fresh and stop it (for a tool the program starts itself, like SUMO, it starts nothing), PORTS for each service's port, and every line it prints as metric=value is a field a check below can hold to a budget.`},{id:`blender`,boxNeeds:e=>(e[`references/gold.py`]??``).trim()?void 0:`The box renders its photos from your correct answer, so it can be built once references/gold.py is written (5.2, Correct answer).`,check:()=>`blender --version | head -1`,name:`Blender`,what:`A Docker container with headless Blender 5.2, a camera rig and a render tool. The agent builds a 3D model from photos and saves /app/model.blend. You write the real object once, as a Blender script: the photos are rendered from it, and the grader, already written, compares the model with it by outline from the photos' cameras and from cameras the agent never saw, part by part, and with its joints bent if you name any.`,skill:`Requires Python (Blender's)`,kind:`Docker sandbox`,docker:!0,fixture:!1,tools:`bash(command), submit(notes)`,grading:`outline from 5 cameras, surface part by part, joints bent, structure; reward 0.00 to 1.00`,needs:`a script that builds the real object`,write:[`the prompt: what to model, and what each joint is called`,`gold.py: builds the real object; the photos are rendered from it`,`naive_a.py: one that looks right in the photos and is wrong`,`verifier/poses.json, if it has joints: the angles to bend them to`],env:{image:`debian:12-slim`,packages:yt,cpu:2,mem:4,disk:8,timeout:1800,steps:100,network:!1,dockerfile_generated:!0,variant:`5.2.2`,tools:[`view_image`]},builtin:[],files:[{path:`agent/PROMPT.md`,purpose:`What to model, and the names its joints go by`,by:`you`},{path:`environment/Dockerfile`,purpose:`Blender, the photos rendered from gold.py, the rig and render tool`,by:`generated`},{path:`environment/data/common.py`,purpose:`The camera rig: where the cameras stand, which are photos`,by:`generated`},{path:`environment/data/render.py`,purpose:`Renders a .blend from any camera, shaded like the photos`,by:`generated`},{path:`/app/photos/`,purpose:`The photos, rendered from gold.py at build time`,by:`generated`},{path:`references/gold.py`,purpose:`Builds the real object. It has to score 1.00`,by:`you`,withheld:!0},{path:`references/naive_a.py`,purpose:`An object that looks right and is wrong`,by:`you`,withheld:!0},{path:`verifier/poses.json`,purpose:`Joints to bend, by object name, in degrees about its X axis`,by:`you`,withheld:!0},{path:`verifier/report.py`,purpose:`The grader: writes the reward and each check`,by:`generated`,withheld:!0},{path:`/app/model.blend`,purpose:`Where the agent saves its model`,by:`agent`}],answer:`py`,artifact:`/app/model.blend`,verifier:()=>bt,variants:{label:`Blender`,options:[{id:`5.2.2`,name:`Blender 5.2.2 LTS`}]},seed:()=>Dt,stages:St,install:()=>Ct,example:()=>kt},{id:`kicad`,boxNeeds:tn,check:()=>`kicad-cli version`,name:`KiCad`,what:`A Docker container with KiCad 10: kicad-cli and pcbnew's Python. You hand over a board and its project as board.kicad_pcb and board.kicad_pro, and the schematic it must match as board.kicad_sch if it has one; the agent edits the board, and the schematic where verifier/rules.json lets it, and saves them in place. The grader, already written, runs KiCad's design rule check with your project's rules and against your schematic, checks nothing is left unconnected and no part moved, and holds what you name in verifier/rules.json: a net to a width, a layer and no vias, a pad to the net it must be on.`,skill:`Requires Python (pcbnew)`,kind:`Docker sandbox`,docker:!0,fixture:!1,tools:`bash(command), submit(notes)`,grading:`DRC with your rules, a match with your schematic, connectivity, parts in place, and your rules per net; reward 0.00 to 1.00`,needs:`a board, and the board corrected`,write:[`the prompt: what is wrong with the board, or what to add`,`board.kicad_pcb and board.kicad_pro, in Environment, and board.kicad_sch if the board is to match a schematic: synced to it in KiCad (Update PCB from Schematic, F8) before you plant the fault`,`gold.py: the corrected board; where the fix changes the schematic, the corrected board.kicad_sch and board.kicad_pcb uploaded beside it, which gold.py copies into place`,`naive_a.py: a fix that looks right and is not`,`verifier/rules.json: nets held to a width, a layer, no vias; pads that must end up on a net; parts the fix may change (one whose value or footprint the schematic changes), in movable; with edit_schematic, the pins that must end up connected or apart`],env:{image:`kicad/kicad:10.0.6`,packages:``,cpu:2,mem:2,disk:8,timeout:300,steps:100,network:!1,dockerfile_generated:!0,tools:[`view_image`]},builtin:[],files:[{path:`agent/PROMPT.md`,purpose:`What is wrong with the board, or what to add`,by:`you`},{path:`environment/Dockerfile`,purpose:`KiCad 10, and the board under /app/data`,by:`generated`},{path:`environment/data/board.kicad_pcb`,purpose:`The board as handed over`,by:`you`},{path:`environment/data/board.kicad_pro`,purpose:`Its project: the design rules DRC runs with`,by:`you`},{path:`environment/data/board.kicad_sch`,purpose:`Its schematic, if it has one: what the board must match`,by:`you`},{path:`references/gold.py`,purpose:`Writes the corrected board. It has to score 1.00`,by:`you`,withheld:!0},{path:`references/naive_a.py`,purpose:`A fix that looks right and is not`,by:`you`,withheld:!0},{path:`verifier/rules.json`,purpose:`Nets held to a width, a layer, no vias; the net each named pad must be on; what may move; whether the agent may edit the schematic, and the pins it must connect or keep apart`,by:`you`,withheld:!0},{path:`verifier/report.py`,purpose:`The grader: DRC with your rules, and the checks above`,by:`generated`,withheld:!0},{path:`/app/data/`,purpose:`The project the agent saves: the board, and the schematic where it may edit it`,by:`agent`}],answer:`py`,artifact:`/app/data/`,answerFiles:en,verifier:()=>zt,variants:{label:`KiCad`,options:[{id:`10.0.6`,name:`KiCad 10.0.6`}]},seed:()=>Bt,example:()=>Vt},{id:`kicad-gui`,boxNeeds:tn,check:()=>`kicad-cli version`,name:`KiCad · GUI`,what:`The KiCad task, done by hand: a Linux desktop with your project open in KiCad 10, its PCB editor and schematic a click away. The agent has no shell and no scripting console: it gets computer(action), a mouse and keyboard with a screenshot after every action, and submit(notes), and saves what it edits: the board, and the schematic where verifier/rules.json lets it. The grader is the KiCad template's: DRC with your project's rules and against your schematic, nothing unconnected, no part moved, and what you name in verifier/rules.json.`,skill:`Requires Python (pcbnew), for your answers`,kind:`Desktop sandbox`,docker:!0,fixture:!1,tools:`computer(action), submit(notes)`,grading:`DRC with your rules, a match with your schematic, connectivity, parts in place, and your rules per net, on the board it saved; reward 0.00 to 1.00`,needs:`a board, and the board corrected`,write:[`the prompt: what is wrong with the board, or what to add, and that it is to be saved; that the KiCad window opens the PCB and Schematic Editors, and that Ctrl+Q in one quits KiCad`,`board.kicad_pcb and board.kicad_pro, in Environment, and board.kicad_sch if the board is to match a schematic: synced to it in KiCad (Update PCB from Schematic, F8) before you plant the fault`,`gold.py: the corrected board, written with pcbnew's Python; where the fix changes the schematic, the corrected board.kicad_sch and board.kicad_pcb uploaded beside it, which gold.py copies into place`,`naive_a.py: a fix that looks right and is not`,`verifier/rules.json: nets held to a width, a layer, no vias; pads that must end up on a net; parts the fix may change (one whose value or footprint the schematic changes), in movable; with edit_schematic, the pins that must end up connected or apart`],env:{image:nn,packages:``,cpu:2,mem:4,disk:8,timeout:600,steps:100,network:!1,dockerfile_generated:!0,tools:[`computer`],desktop:`kicad /app/data/board.kicad_pro`},builtin:[],files:[{path:`agent/PROMPT.md`,purpose:`What is wrong with the board, or what to add`,by:`you`},{path:`environment/Dockerfile`,purpose:`The desktop, KiCad 10, and the board under /app/data`,by:`generated`},{path:`environment/data/board.kicad_pcb`,purpose:`The board as handed over`,by:`you`},{path:`environment/data/board.kicad_pro`,purpose:`Its project: the design rules DRC runs with`,by:`you`},{path:`environment/data/board.kicad_sch`,purpose:`Its schematic, if it has one: what the board must match`,by:`you`},{path:`references/gold.py`,purpose:`Writes the corrected board. It has to score 1.00`,by:`you`,withheld:!0},{path:`references/naive_a.py`,purpose:`A fix that looks right and is not`,by:`you`,withheld:!0},{path:`verifier/rules.json`,purpose:`Nets held to a width, a layer, no vias; the net each named pad must be on; what may move; whether the agent may edit the schematic, and the pins it must connect or keep apart`,by:`you`,withheld:!0},{path:`verifier/report.py`,purpose:`The grader: DRC with your rules, and the checks above`,by:`generated`,withheld:!0},{path:`/app/data/`,purpose:`The project the agent saves in the editors: the board, and the schematic where it may edit it`,by:`agent`}],answer:`py`,artifact:`/app/data/`,answerFiles:en,verifier:()=>zt,seed:()=>Bt,example:()=>Vt},{id:`blender-gui`,boxNeeds:e=>(e[`references/gold.py`]??``).trim()?void 0:`The box renders its photos from your correct answer, so it can be built once references/gold.py is written (5.2, Correct answer).`,check:()=>`blender --version | head -1`,name:`Blender · GUI`,what:`The Blender task, done by hand: a Linux desktop with Blender 5.2 open on a scene whose cameras stand where the photos were taken, each photo behind its camera. The agent has no shell, and Blender's Python console and script running are taken out: it gets computer(action), a mouse and keyboard with a screenshot after every action, and submit(notes), and saves /app/model.blend. The grader is the Blender template's: outline from the photos' cameras and from cameras the agent never saw, part by part, and with its joints bent if you name any.`,skill:`Requires Python (Blender's), for your answers`,kind:`Desktop sandbox`,docker:!0,fixture:!1,tools:`computer(action), submit(notes)`,grading:`outline from 5 cameras, surface part by part, joints bent, structure, on the model it saved; reward 0.00 to 1.00`,needs:`a script that builds the real object`,write:[`the prompt: what to model, what each joint is called, and that it is done by hand: there is no shell, and the Python console and script running are disabled`,`gold.py: builds the real object; the photos are rendered from it`,`naive_a.py: one that looks right in the photos and is wrong`,`verifier/poses.json, if it has joints: the angles to bend them to`],env:{image:H,packages:``,cpu:2,mem:4,disk:8,timeout:1800,steps:500,working_time:null,network:!1,dockerfile_generated:!0,tools:[`computer`],desktop:`blender --gpu-backend opengl /app/model.blend`},builtin:[],files:[{path:`agent/PROMPT.md`,purpose:`What to model, the names its joints go by, and that it is done by hand`,by:`you`},{path:`environment/Dockerfile`,purpose:`The Blender desktop, the photos rendered from gold.py, and the scene it opens`,by:`generated`},{path:`environment/data/common.py`,purpose:`The camera rig: where the cameras stand, which are photos`,by:`generated`},{path:`environment/data/start.py`,purpose:`Writes /app/model.blend: a camera per photo, the photo behind it`,by:`generated`},{path:`/app/photos/`,purpose:`The photos, rendered from gold.py at build time`,by:`generated`},{path:`references/gold.py`,purpose:`Builds the real object. It has to score 1.00`,by:`you`,withheld:!0},{path:`references/naive_a.py`,purpose:`An object that looks right and is wrong`,by:`you`,withheld:!0},{path:`verifier/poses.json`,purpose:`Joints to bend, by object name, in degrees about its X axis`,by:`you`,withheld:!0},{path:`verifier/report.py`,purpose:`The grader: writes the reward and each check`,by:`generated`,withheld:!0},{path:`/app/model.blend`,purpose:`The scene the desktop opens; the agent models in it and saves it`,by:`agent`}],answer:`py`,artifact:`/app/model.blend`,verifier:()=>Et(Q(H)),seed:()=>Ot,get stages(){return wt(Q(H))},install:()=>Tt,example:()=>kt},{id:`freecad-gui`,check:()=>`freecadcmd --version`,name:`FreeCAD · GUI`,what:`A part modelled by hand: a Linux desktop with FreeCAD 1.1 open on an empty document, /app/part.FCStd, in Part Design. You hand over the drawing it is modelled from. The agent has no shell, and FreeCAD's Python console, macros and code workbenches are taken out: it gets computer(action), a mouse and keyboard with a screenshot after every action, and submit(notes), and saves the document. The grader, already written, compares the part with the real one gold.py builds: the solid they share, size and place, and each feature you name in verifier/features.json, by points the real part says are solid or empty.`,skill:`Requires Python (FreeCAD's), for your answers`,kind:`Desktop sandbox`,docker:!0,fixture:!1,tools:`computer(action), submit(notes)`,grading:`shared solid, size and place, and your features point by point, on the part it saved; reward 0.00 to 1.00`,needs:`a drawing, and a script that builds the part`,write:[`the prompt: the part, where the drawing is, where its origin and axes are, and that it is done by hand: there is no shell, and the Python console and macros are disabled`,`the drawing, in Environment`,`gold.py: builds the real part with FreeCAD's Python and saves /app/part.FCStd`,`naive_a.py: the part with one mistake a drafter makes, such as a misread dimension`,`verifier/features.json: per feature, points either side of its surfaces; the real part says which are solid`],env:{image:U,packages:``,cpu:2,mem:4,disk:8,timeout:1800,steps:100,network:!1,dockerfile_generated:!0,tools:[`computer`],desktop:`freecad /app/part.FCStd`},builtin:[],files:[{path:`agent/PROMPT.md`,purpose:`The part, the drawing, its origin and axes, and that it is done by hand`,by:`you`},{path:`environment/Dockerfile`,purpose:`The FreeCAD desktop, and the empty document it opens on`,by:`generated`},{path:`/app/files/`,purpose:`The drawing, and anything else you hand over`,by:`you`},{path:`references/gold.py`,purpose:`Builds the real part. It has to score 1.00`,by:`you`,withheld:!0},{path:`references/naive_a.py`,purpose:`The part with one common mistake`,by:`you`,withheld:!0},{path:`verifier/features.json`,purpose:`Per feature, the points the grader checks either side of its surfaces`,by:`you`,withheld:!0},{path:`verifier/report.py`,purpose:`The grader: writes the reward and each check`,by:`generated`,withheld:!0},{path:`/app/part.FCStd`,purpose:`Where the agent saves its part`,by:`agent`}],answer:`py`,artifact:`/app/part.FCStd`,verifier:()=>Nt(Q(U)),seed:()=>Ft,install:()=>Pt,example:()=>It},{id:`rtl-gui`,boxNeeds:e=>Object.keys(e).some(e=>e.startsWith(`environment/data/`))?void 0:`The box simulates your design as it opens, so it can be built once the design, its testbench, Makefile and waves.gtkw are added (3.1, Environment).`,check:()=>`iverilog -V 2>&1 | head -1`,name:`RTL · GUI`,what:`A Verilog bug found the way a verification engineer finds one: a Linux desktop with GTKWave open on your failing simulation and Mousepad on the design, the simulation re-run whenever a file is saved. The agent has no shell: it gets computer(action), a mouse and keyboard with a screenshot after every action, and submit(notes), and saves the fixed /app/data/design.v. The grader, already written, checks it is synthesizable RTL that names nothing outside itself and cannot print a check or end a run, then runs each of your withheld testbenches in verifier/rtl.json, at the parameters you name, on Icarus Verilog and on Verilator at 16 random power-up states: a check passes only if it passes on every run.`,skill:`Requires Verilog, for the design and the testbenches`,kind:`Desktop sandbox`,docker:!0,fixture:!1,tools:`computer(action), submit(notes)`,grading:`your withheld testbenches, check by check, on the design it saved; reward 0.00 to 1.00`,needs:`a design with a bug, and the design fixed`,write:[`the prompt: what fails, the block's spec, and that only design.v is graded, at other parameters too`,`design.v, its testbench, a Makefile whose default target writes sim.log and dump.vcd, and waves.gtkw, in Environment`,`gold.py: writes the fixed design.v`,`naive_a.py: a fix that passes your testbench and is wrong`,`verifier/rtl.json and the testbenches it names, each reading +nonce, printing CHECK <nonce> <name> PASS or FAIL, then DONE <nonce>`],env:{image:rn,packages:``,cpu:2,mem:4,disk:8,timeout:900,steps:300,working_time:null,network:!1,dockerfile_generated:!0,tools:[`computer`],desktop:qt},builtin:[],files:[{path:`agent/PROMPT.md`,purpose:`What fails, the block's spec, and what is graded`,by:`you`},{path:`environment/Dockerfile`,purpose:`The RTL desktop, and your files under /app/data`,by:`generated`},{path:`environment/data/design.v`,purpose:`The design as handed over, with its bug`,by:`you`},{path:`environment/data/Makefile`,purpose:`Its default target simulates the testbench into sim.log and dump.vcd`,by:`you`},{path:`environment/data/waves.gtkw`,purpose:`The signals GTKWave opens on`,by:`you`},{path:`references/gold.py`,purpose:`Writes the fixed design. It has to score 1.00`,by:`you`,withheld:!0},{path:`references/naive_a.py`,purpose:`A fix that passes your testbench and is wrong`,by:`you`,withheld:!0},{path:`verifier/rtl.json`,purpose:`The design file, and each testbench with its parameters and the checks it prints`,by:`you`,withheld:!0},{path:`verifier/report.py`,purpose:`The grader: writes the reward and each check`,by:`generated`,withheld:!0},{path:`/app/data/design.v`,purpose:`The design the agent fixes and saves`,by:`agent`}],answer:`py`,artifact:`/app/data/design.v`,verifier:()=>Kt(Q(W)),seed:()=>Jt,example:()=>Yt},{id:`rtl`,check:()=>`iverilog -V 2>&1 | head -1 && verilator --version`,name:`RTL · terminal`,what:"A change to a Verilog block, made the way an RTL engineer makes it: a shell in a Debian box with Icarus Verilog 13, Verilator 5.048 and make, your design, its smoke testbench and spec. The agent edits the design files and submits. The grader, already written, checks they are synthesizable RTL that names nothing outside themselves and cannot print a check or end a run, then runs each of your withheld testbenches in verifier/rtl.json, at the parameters you name, on Icarus Verilog and on Verilator at 16 random power-up states, each run with a fresh stimulus seed: a check passes only if it passes on every run. Checks the design already passed as handed over go in `must`: failing one scores 0, and they pay nothing.",skill:`Requires Verilog, for the design and the testbenches`,kind:`Docker sandbox`,docker:!0,fixture:!1,tools:`bash(command), submit(notes)`,grading:`your withheld testbenches, check by check, on the design it saved; reward 0.00 to 1.00, the design as handed over 0.00`,needs:`a working design and a change request, or a design with a bug, and the design changed`,write:[`the prompt: the change request or the failure, the full interface and timing contract, and which files are graded`,`the design files, a smoke testbench that says nothing about what is graded, and a Makefile that runs it, in Environment`,`gold.py: writes the changed design`,`naive_base.py: writes the design as handed over. It has to score 0.00`,`naive_a.py: the most likely wrong change`,`verifier/rtl.json and the testbenches it names, each reading +nonce and +seed, printing CHECK <nonce> <name> PASS or FAIL, then DONE <nonce>`],env:{image:W,packages:Gt,cpu:4,mem:8,disk:8,timeout:900,steps:300,working_time:3600,network:!1,dockerfile_generated:!0},builtin:[],files:[{path:`agent/PROMPT.md`,purpose:`The change request, the spec, and what is graded`,by:`you`},{path:`environment/Dockerfile`,purpose:`Debian with Icarus Verilog 13 and Verilator 5.048, and your files under /app/data`,by:`generated`},{path:`environment/data/design.v`,purpose:`The design as handed over`,by:`you`},{path:`environment/data/Makefile`,purpose:`Runs the smoke testbench`,by:`you`},{path:`references/gold.py`,purpose:`Writes the changed design. It has to score 1.00`,by:`you`,withheld:!0},{path:`references/naive_base.py`,purpose:`Writes the design as handed over. It has to score 0.00`,by:`you`,withheld:!0},{path:`references/naive_a.py`,purpose:`The most likely wrong change`,by:`you`,withheld:!0},{path:`verifier/rtl.json`,purpose:"The design files, `must`, and each testbench with its parameters and the checks it prints",by:`you`,withheld:!0},{path:`verifier/report.py`,purpose:`The grader: writes the reward and each check`,by:`generated`,withheld:!0},{path:`/app/data/design.v`,purpose:`The design the agent changes`,by:`agent`}],answer:`py`,artifact:`/app/data/design.v`,verifier:()=>Kt(Q(W)),seed:()=>Jt,example:()=>Yt},{id:`desktop`,name:`Desktop · GUI app`,what:`A Linux desktop with your app open on the files you hand over: LibreOffice Calc, PulseView, or any app you install. The agent has no shell: it gets computer(action), a mouse and keyboard with a screenshot after every action, and submit(notes). What it submits is its answer, saved as /app/answer.txt, unless you make the answer a file the app saves, such as /app/model.blend. Your steps score it like any other.`,skill:`No code needed`,kind:`Desktop sandbox`,docker:!0,fixture:!1,tools:`computer(action), submit(notes)`,grading:`your scored steps, read off the submitted answer; reward 0.00 to 1.00`,needs:`a file to open, and its correct answer`,write:[`the prompt: what to find or do in the app, and the lines to answer with`,`the file the app opens, in Environment`,`gold.txt: the correct answer, or gold.py writing the file the app saves`,`naive_a.txt: the answer a hurried colleague would give, written the same way`],env:{image:$t,packages:G[0].packages,cpu:2,mem:2,disk:8,timeout:300,steps:40,network:!1,dockerfile_generated:!0,tools:[`computer`],desktop:G[0].desktop},builtin:[],files:[{path:`agent/PROMPT.md`,purpose:`What to find or do in the app`,by:`you`},{path:`environment/Dockerfile`,purpose:`The desktop, the app, and your files under /app/data`,by:`generated`},{path:`environment/data/`,purpose:`The files the app opens`,by:`you`},{path:`references/gold.txt`,purpose:`Your correct answer, or a gold.py that writes the file the app saves. It has to score 1.00`,by:`you`,withheld:!0},{path:`references/naive_a.txt`,purpose:`The answer a hurried colleague would give, written the same way`,by:`you`,withheld:!0},{path:`/app/answer.txt`,purpose:"What the agent submits, one `Label: value` per line, unless the answer is a file the app saves",by:`agent`}],answer:`py`,artifact:`/app/answer.txt`},{id:`count`,name:`No shell · exact match`,what:`No sandbox. The agent reads the prompt and calls submit(answer) once. Reward is 1 if it matches, 0 if not.`,skill:`No code needed`,kind:`No shell`,docker:!1,fixture:!0,tools:`submit(answer) only`,grading:`exact match, reward 0 or 1`,needs:`a model, nothing else`,write:[`the question, as the prompt`,`the one correct answer`],env:{image:`none (no sandbox)`,packages:``,cpu:1,mem:1,disk:1,timeout:60,steps:10,network:!1,dockerfile_generated:!1},builtin:[`strawberry`,`banana`,`mississippi`],files:[{path:`agent/PROMPT.md`,purpose:`The question, as the prompt`,by:`you`},{path:`task.json`,purpose:`The one correct answer`,by:`you`,withheld:!0}],answer:`py`,artifact:`/app/answer.txt`},{id:`alpha_sort`,name:`No shell · partial credit`,what:`No sandbox. The agent submits an ordered list. Reward is the fraction of items in the right position, so it can be 0.83, not just pass or fail.`,skill:`No code needed`,kind:`No shell`,docker:!1,fixture:!0,tools:`submit(list) only`,grading:`fraction in position, reward 0.00 to 1.00`,needs:`a model, nothing else`,write:[`the list and the ordering rule`,`the correct order`],env:{image:`none (no sandbox)`,packages:``,cpu:1,mem:1,disk:1,timeout:60,steps:10,network:!1,dockerfile_generated:!1},builtin:[`last-6-s1`,`first-6-s2`,`last-8-s3`],files:[{path:`agent/PROMPT.md`,purpose:`The list and the ordering rule`,by:`you`},{path:`task.json`,purpose:`The correct order`,by:`you`,withheld:!0}],answer:`py`,artifact:`/app/answer.txt`}],on=e=>K.find(t=>t.id===e)??K[0];function sn(e){let t=new Map;for(let n of e)t.set(n.group??``,[...t.get(n.group??``)??[],n]);return[...t].sort(([e],[t])=>e.localeCompare(t,`en`,{numeric:!0})).map(([e,t])=>({group:e,options:t}))}var q=(e,t)=>e.variants?.options.find(e=>e.id===t)??e.variants?.options[0],J=(e,t)=>q(e,t)?.artifact??e.artifact,Y=(e,t)=>q(e,t)?.answer??e.answer,X=[`txt`,`md`];function cn(e,t){let n=/\.([^./]+)$/.exec(t)?.[1]??``;return e.answer===`py`&&!e.harness&&!e.rig&&X.includes(n)?n:null}var Z=(e,t)=>q(e,t)?.harness??e.harness,ln=e=>{let t=on(e.template),n=e.env.variant;return{...t,artifact:J(t,n),answer:Y(t,n),harness:Z(t,n)}},un=K.filter(e=>e.docker);function dn(e,t){let n=[];for(let r of t.map(e=>e.trim()).filter(Boolean)){if(!r.startsWith(`/`))return{paths:n,error:`${r} is not an absolute path in the container, like /app/notes.md or /app/project/`};if(r===e)return{paths:n,error:`${r} is the main answer already`};if(n.includes(r))return{paths:n,error:`${r} is listed twice`};n.push(r)}return{paths:n,error:``}}function fn(e,t,n){let r={},i=cn({...t,answer:Y(t,n),harness:Z(t,n)},J(t,n));for(let[a,o]of Object.entries(e)){let e=/^references\/(.+)\.(py|c|ttcn)$/.exec(a)??/^references\/(gold|naive_[^/]+)\.(txt|md)$/.exec(a);r[e?`references/${e[1]}.${i&&X.includes(e[2])?i:Y(t,n)}`:a]=o}let a={};try{a=JSON.parse(r[`task.json`]??`{}`)}catch{}let{harness:o,...s}=a,c=J(t,n),l=(s.artifacts??[]).filter(e=>e!==s.primary_artifact&&e!==c);r[`task.json`]=JSON.stringify({...s,artifacts:[c,...l],primary_artifact:c,...Z(t,n)?{harness:!0}:{}},null,2)+`
`;for(let e of K)for(let t of e.variants?.options??[])for(let[n,i]of Object.entries(e.seed?.(t.id)??{}))r[n]===i&&delete r[n];(e=>!e||K.some(t=>[void 0,...(t.variants?.options??[]).map(e=>e.id)].some(n=>t.verifier?.(n)===e)))(r[`verifier/Dockerfile`])&&(t.verifier?r[`verifier/Dockerfile`]=t.verifier(n):delete r[`verifier/Dockerfile`]);for(let[e,i]of Object.entries(t.seed?.(n)??{}))e===`verifier/drive.py`&&r[e]&&r[e]!==i?(r[`verifier/drive.previous.py`]=r[e],r[e]=i):r[e]??=i;return r}var pn={"python:3.12-slim":`sha256:78387bc3881b8273120a12ebe6c1ab22b018ccc2c9adf565ae1ac9b536e184ea`,"python:3.12-slim-bookworm":`sha256:782412e85d0f0984994c290652577d4018aff08145c85b262bb63dc0c7522254`,"debian:12-slim":`sha256:3783cc01769c7b2b1b83a5c5ad96c815348e28ed7da68e2e3687004faa906251`,"kicad/kicad:10.0.6":`sha256:18693567392b80da435f9fa952ce3a3e534c66eb5a6033f5b9c80aa3b19dd3ec`,[$t]:`sha256:9aeee199db95b4e07488110950760b013045d8705aab7d74a6e085a9ff0c74d0`,[nn]:`sha256:6ef4e7b256791e27ef953192a8b225f00533217a33df991e71378c5c31cf2578`,[H]:`sha256:53d66f83a6ad109fac751fee35de8f6ab0f85ed2345e2024789a62f282a197b0`,[U]:`sha256:1ca6b6a0ec50bcb9bde404ada88895c3e75a7e8d56bdeed0ccd21be8a9d3674c`,[rn]:`sha256:442b7dc13cd936eb562278fd37b6480b601156bf728e347afaebc1938b80aa45`,[W]:`sha256:3c80e257eff6274d593eb33a94bda5174ccd619836e6a728a73e11c97f2213e3`},mn=[`kicad/kicad:10.0.6`];function Q(e){if(e.includes(`@`))return e;let t=pn[e];return t?`${e}@${t}`:e}var $=e=>(e||``).split(`,`).map(e=>e.trim()).filter(Boolean);function hn(e,t,n){let r=new Set($(t));return[...new Set([...$(n),...$(e).filter(e=>!r.has(e))])].join(`, `)}function gn(e,n,r=[],a=[]){let o=$(e.packages),s=L.filter(t=>e.addons?.includes(t.id)),c=e.tools?.includes(`computer`)&&!e.image?.startsWith(an)?Qt:[],l=[...new Set([...o.filter(e=>!e.startsWith(`pip:`)),...s.flatMap(e=>e.apt)])].filter(e=>!c.includes(e)),u=c.length?[`RUN apt-get update && apt-get install -y --no-install-recommends \\`,...[c.slice(0,6),c.slice(6,10),c.slice(10),...l.length?[l]:[]].map(e=>`    ${e.join(` `)} \\`),` && rm -rf /var/lib/apt/lists/*`].join(`
`):`RUN apt-get update && apt-get install -y --no-install-recommends ${l.join(` `)} && rm -rf /var/lib/apt/lists/*`,d=[...new Set([...o.filter(e=>e.startsWith(`pip:`)).map(e=>e.slice(4)),...s.flatMap(e=>e.pip)])];return r=[...new Set([...r,...s.flatMap(e=>e.install)])],[...a,`FROM ${Q(e.image||`python:3.12-slim`)}`,...mn.includes(e.image)?[`USER root`]:[],...l.length||c.length?[t,u]:[],...r,...d.length?[i(d.join(` `))]:[],`WORKDIR /app`,...n?[`COPY environment/data /app/data`]:[]].join(`
`)+`
`}export{w as _,X as a,fn as c,ln as d,cn as f,st as g,ot as h,K as i,hn as l,L as m,G as n,gn as o,sn as p,Qt as r,dn as s,un as t,on as u,s as v,se as y};
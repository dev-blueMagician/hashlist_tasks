/* Reset: copy .data from flash, zero .bss, call app_main. */
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

/* system_clock.c - clock tree of the ECP-300
 *
 * HSE 8 MHz crystal -> PLL M = 8, N = 336, P = 2 -> SYSCLK 168 MHz, Q = 7 -> 48 MHz
 * AHB /1 = 168 MHz (core, DWT), APB1 /4 = 42 MHz (bxCAN), APB2 /2 = 84 MHz
 * Flash: 5 wait states, prefetch, instruction and data cache on.
 */
#include "stm32f4xx.h"

uint32_t SystemCoreClock = 168000000u;
uint32_t g_lsi_hz;                       /* measured at start-up, stored in the freeze frames */

void system_clock_init(void)
{
    RCC->CR |= RCC_CR_HSEON;
    while ((RCC->CR & RCC_CR_HSERDY) == 0u) { }

    RCC->APB1ENR |= RCC_APB1ENR_PWREN;
    PWR->CR |= PWR_CR_VOS;                               /* scale 1 for 168 MHz */

    RCC->CFGR = RCC_CFGR_HPRE_DIV1 | RCC_CFGR_PPRE1_DIV4 | RCC_CFGR_PPRE2_DIV2;
    RCC->PLLCFGR = (8u << RCC_PLLCFGR_PLLM_Pos) | (336u << RCC_PLLCFGR_PLLN_Pos)
                 | (0u << RCC_PLLCFGR_PLLP_Pos) | RCC_PLLCFGR_PLLSRC_HSE
                 | (7u << RCC_PLLCFGR_PLLQ_Pos);
    RCC->CR |= RCC_CR_PLLON;
    while ((RCC->CR & RCC_CR_PLLRDY) == 0u) { }

    FLASH->ACR = FLASH_ACR_LATENCY_5WS | FLASH_ACR_PRFTEN | FLASH_ACR_ICEN | FLASH_ACR_DCEN;
    RCC->CFGR |= RCC_CFGR_SW_PLL;
    while ((RCC->CFGR & RCC_CFGR_SWS) != RCC_CFGR_SWS_PLL) { }

    RCC->CSR |= RCC_CSR_LSION;                           /* IWDG clock */
    while ((RCC->CSR & RCC_CSR_LSIRDY) == 0u) { }
}

/* LSI frequency for the diagnostic freeze frame: TIM5 channel 4 captures
 * the LSI (TIM5_OR TI4_RMP = 01) with the timer on 2 x PCLK1 = 84 MHz;
 * eight LSI periods are averaged. Diagnostic only, not used for timing. */
void lsi_measure(void)
{
    RCC->APB1ENR |= RCC_APB1ENR_TIM5EN;
    TIM5->OR = (1u << 6);                                /* TI4_RMP: LSI */
    TIM5->CCMR2 = (1u << 8) | (3u << 10);                /* CC4 input TI4, prescaler /8 */
    TIM5->CCER = TIM_CCER_CC4E;
    TIM5->CR1 = TIM_CR1_CEN;
    uint32_t a, b;
    while ((TIM5->SR & TIM_SR_CC4IF) == 0u) { }
    a = TIM5->CCR4;
    while ((TIM5->SR & TIM_SR_CC4IF) == 0u) { }
    b = TIM5->CCR4;
    g_lsi_hz = (uint32_t)((8ull * 84000000ull) / (uint32_t)(b - a));
    TIM5->CR1 = 0u;
    RCC->APB1ENR &= ~RCC_APB1ENR_TIM5EN;
}

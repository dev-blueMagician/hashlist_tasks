/* foc_isr.c - field-oriented current control
 *
 * TIM1 (Pwm driver, mcal/) triggers the injected ADC1/ADC2 conversions of the phase
 * currents. The injected end-of-conversion interrupt runs the current loop
 * and writes the new duty cycles. NVIC priority 1 (above
 * configMAX_SYSCALL_INTERRUPT_PRIORITY): no FreeRTOS calls in here.
 */
#include "stm32f4xx.h"
#include "tmon.h"
#include "foc.h"
#include "trace_rec.h"

void foc_isr_init(void)
{
    NVIC_SetPriority(ADC_IRQn, 1u);
    NVIC_EnableIRQ(ADC_IRQn);
}

void ADC_IRQHandler(void)
{
    TMON_ISR_ENTER();
    trace_rec_isr_enter(TR_ISR_ADC, 0u);

    ADC1->SR = ~ADC_SR_JEOC;
    foc_sample_t s = {
        .ia = (int16_t)ADC1->JDR1,
        .ib = (int16_t)ADC2->JDR1,
        .vdc = (int16_t)ADC1->JDR2,
    };
    foc_duty_t d;
    foc_current_loop(&s, &d);       /* Clarke/Park, PI d/q, field weakening, SVM */
    TIM1->CCR1 = d.a;
    TIM1->CCR2 = d.b;
    TIM1->CCR3 = d.c;

    trace_rec_isr_exit(TR_ISR_ADC);
    TMON_ISR_EXIT();
}

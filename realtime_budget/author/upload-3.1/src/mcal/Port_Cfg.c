/*==========================================================================
 * Port_Cfg.c
 * Port driver configuration
 * PortConfigurator 4.1.2 (MCAL STM32F4 R4.2.2)
 * Generated on 2026-05-28 14:02:11 from ECP300_MCAL.mcfg rev 41. Do not edit.
 *==========================================================================*/
#include "Port_Cfg.h"

/* Pin assignment
 *   PA0   analog AF0  ADC123_IN0  phase current A
 *   PA1   analog AF0  ADC123_IN1  phase current B
 *   PA2   analog AF0  ADC123_IN2  DC-link voltage
 *   PA3   analog AF0  ADC123_IN3  spare
 *   PA8   af     AF1  TIM1_CH1    phase A high side
 *   PA9   af     AF1  TIM1_CH2    phase B high side
 *   PA10  af     AF1  TIM1_CH3    phase C high side
 *   PA11  af     AF9  CAN1_RX
 *   PA12  af     AF9  CAN1_TX
 *   PA13  af     AF0  SWDIO
 *   PA14  af     AF0  SWCLK
 *   PB6   out    AF0  DIO         gate driver enable
 *   PB7   in     AF0  DIO         gate driver fault (low active)
 *   PB12  af     AF1  TIM1_BKIN   overcurrent comparator
 *   PB13  af     AF1  TIM1_CH1N   phase A low side
 *   PB14  af     AF1  TIM1_CH2N   phase B low side
 *   PB15  af     AF1  TIM1_CH3N   phase C low side
 *   PC0   analog AF0  ADC123_IN10 board temperature
 *   PC1   analog AF0  ADC123_IN11 power stage temperature
 *   PC2   analog AF0  ADC123_IN12 coolant temperature
 *   PC3   analog AF0  ADC123_IN13 motor winding temperature
 *   PC13  out    AF0  DIO         status LED
 *   PC14  in     AF0  DIO         hardware variant bit 0
 *   PC15  in     AF0  DIO         hardware variant bit 1
 */

static const Mcal_RegInitType Port_InitRegs[] = {
    { 0x40020024u, 0x00099111u },   /*  0 */
    { 0x40020020u, 0x00000000u },   /*  1 */
    { 0x4002000Cu, 0x24000000u },   /*  2 */
    { 0x40020008u, 0x2ABF0000u },   /*  3 */
    { 0x40020004u, 0x00000000u },   /*  4 */
    { 0x40020000u, 0x2AAA00FFu },   /*  5 */
    { 0x40020424u, 0x11110000u },   /*  6 */
    { 0x40020420u, 0x00000000u },   /*  7 */
    { 0x4002040Cu, 0x01004000u },   /*  8 */
    { 0x40020408u, 0xFF001000u },   /*  9 */
    { 0x40020404u, 0x00000000u },   /* 10 */
    { 0x40020400u, 0xAA001000u },   /* 11 */
    { 0x40020824u, 0x00000000u },   /* 12 */
    { 0x40020820u, 0x00000000u },   /* 13 */
    { 0x4002080Cu, 0xA0000000u },   /* 14 */
    { 0x40020808u, 0x00000000u },   /* 15 */
    { 0x40020804u, 0x00000000u },   /* 16 */
    { 0x40020800u, 0x040000FFu },   /* 17 */
};

const Port_ConfigType Port_Config = { MCAL_SEQ(Port_InitRegs) };

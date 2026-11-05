/* FreeRTOSConfig.h - ECP-300, FreeRTOS 10.5.1, ARM_CM4F port (excerpt) */
#ifndef FREERTOS_CONFIG_H
#define FREERTOS_CONFIG_H

#include <stdint.h>
extern uint32_t SystemCoreClock;

#define configUSE_PREEMPTION                    1
#define configUSE_TIME_SLICING                  0
#define configUSE_PORT_OPTIMISED_TASK_SELECTION 1
#define configUSE_TICKLESS_IDLE                 0
#define configCPU_CLOCK_HZ                      ( SystemCoreClock )
#define configTICK_RATE_HZ                      ( ( TickType_t ) 1000 )
#define configMAX_PRIORITIES                    ( 8 )
#define configMINIMAL_STACK_SIZE                ( ( uint16_t ) 128 )
#define configSUPPORT_STATIC_ALLOCATION         1
#define configSUPPORT_DYNAMIC_ALLOCATION        0
#define configUSE_TICK_HOOK                     1       /* TMON runaway check */
#define configUSE_APPLICATION_TASK_TAG          1
#define configCHECK_FOR_STACK_OVERFLOW          2

/* Cortex-M4: 4 priority bits */
#define configPRIO_BITS                         4
#define configKERNEL_INTERRUPT_PRIORITY         ( 15 << ( 8 - configPRIO_BITS ) )
#define configMAX_SYSCALL_INTERRUPT_PRIORITY    ( 5 << ( 8 - configPRIO_BITS ) )
/* NVIC priorities in use: ADC (FOC) 1, CAN1_RX0 6, SysTick and PendSV 15 */

#define vPortSVCHandler     SVC_Handler
#define xPortPendSVHandler  PendSV_Handler
#define xPortSysTickHandler SysTick_Handler

/* trace recorder and TMON */
#include "trace_hooks.h"
#define traceTASK_SWITCHED_IN()   trace_hook_switched_in( pxCurrentTCB )
#define traceTASK_SWITCHED_OUT()  trace_hook_switched_out( pxCurrentTCB )
#define traceMOVED_TASK_TO_READY_STATE( pxTCB )  trace_hook_ready( pxTCB )

#endif /* FREERTOS_CONFIG_H */

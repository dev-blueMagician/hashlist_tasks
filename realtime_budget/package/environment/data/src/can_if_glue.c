/* can_if_glue.c - bxCAN1 hardware set-up and receive interrupt for CanIf 4.2
 *
 * New in 3.2.0, replaces can_legacy.c. Reception runs in interrupt mode:
 * each received frame is handed to the CanIf stack from the FIFO 0
 * interrupt (HRH lookup, PduR routing and CanTp all run in the handler).
 * Transmission is done from the CanComm task.
 *
 * Vehicle bus: 500 kbit/s, 11-bit identifiers (VN-07).
 */
#include "stm32f4xx.h"
#include "CanIf.h"
#include "trace_rec.h"

#define CAN_RX_IRQ_PRIO  6u     /* below configMAX_SYSCALL_INTERRUPT_PRIORITY (5): CanIf uses FromISR calls */

void can_hw_init(void)
{
    RCC->APB1ENR |= RCC_APB1ENR_CAN1EN;

    CAN1->MCR = CAN_MCR_INRQ | CAN_MCR_ABOM | CAN_MCR_TXFP;
    while ((CAN1->MSR & CAN_MSR_INAK) == 0u) { }

    /* PCLK1 = 42 MHz: BRP = 6, 1 + 10 + 3 = 14 tq per bit -> 500 kbit/s, sample point 78.6 % */
    CAN1->BTR = (2u << 24)      /* SJW = 3 tq */
              | (2u << 20)      /* TS2 = 3 tq */
              | (9u << 16)      /* TS1 = 10 tq */
              | (6u - 1u);      /* BRP */

    /* acceptance filters, all assigned to FIFO 0 */
    CAN1->FMR |= CAN_FMR_FINIT;
    CAN1->FS1R = (1u << 0) | (1u << 1);         /* banks 0, 1: one 32-bit filter each */
    CAN1->FM1R = (1u << 0);                     /* bank 0: identifier list, bank 1: identifier/mask */
    CAN1->FFA1R = 0u;
    CAN1->sFilterRegister[0].FR1 = 0x18Au << 21;    /* TMS pump setpoint */
    CAN1->sFilterRegister[0].FR2 = 0x6F1u << 21;    /* physical diagnostic request to the pump */
    CAN1->sFilterRegister[1].FR1 = 0x7DFu << 21;    /* functional diagnostic request (new in 3.2) */
    CAN1->sFilterRegister[1].FR2 = 0x700u << 21;
    CAN1->FA1R = (1u << 0) | (1u << 1);
    CAN1->FMR &= ~CAN_FMR_FINIT;

    CAN1->IER = CAN_IER_FMPIE0;
    NVIC_SetPriority(CAN1_RX0_IRQn, CAN_RX_IRQ_PRIO);
    NVIC_EnableIRQ(CAN1_RX0_IRQn);

    CAN1->MCR &= ~CAN_MCR_INRQ;
    while ((CAN1->MSR & CAN_MSR_INAK) != 0u) { }
}

void CAN1_RX0_IRQHandler(void)
{
    while ((CAN1->RF0R & CAN_RF0R_FMP0) != 0u) {
        Can_HwType hw;
        PduInfoType pdu;
        uint8_t data[8];
        CAN_FIFOMailBox_TypeDef *mb = &CAN1->sFIFOMailBox[0];

        hw.CanId = (mb->RIR >> 21) & 0x7FFu;
        trace_rec_isr_enter(TR_ISR_CAN_RX0, hw.CanId);
        hw.Hoh = CANIF_HRH_FIFO0;
        hw.ControllerId = 0u;
        pdu.SduLength = (uint8_t)(mb->RDTR & 0x0Fu);
        *(uint32_t *)&data[0] = mb->RDLR;
        *(uint32_t *)&data[4] = mb->RDHR;
        pdu.SduDataPtr = data;
        CAN1->RF0R = CAN_RF0R_RFOM0;            /* release the FIFO output mailbox */

        CanIf_RxIndication(&hw, &pdu);
        trace_rec_isr_exit(TR_ISR_CAN_RX0);
    }
}

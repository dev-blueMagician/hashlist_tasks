/*==========================================================================
 * Mcal_Types.h
 * Common types of the generated configuration
 * MCAL STM32F4 R4.2.2, static code
 * Generated on 2026-05-28 14:02:11 from ECP300_MCAL.mcfg rev 41. Do not edit.
 *==========================================================================*/
#ifndef MCAL_TYPES_H
#define MCAL_TYPES_H

#include "Std_Types.h"

/* One register write of a configuration sequence, applied in table order. */
typedef struct {
    uint32 addr;
    uint32 value;
} Mcal_RegInitType;

typedef struct {
    const Mcal_RegInitType *regs;
    uint16 count;
} Mcal_RegSeqType;

#define MCAL_SEQ(t)   { (t), (uint16)(sizeof(t) / sizeof((t)[0])) }

#endif

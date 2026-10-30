# Scored-step texts: saved text against what each check measures

Each 5.4 text labels its check in task.json, the test file and Verify's step table. The text does not change any score. Earlier advice (5.4, 2026-10-30) kept several generated texts because "the step text is only a hidden label". That was wrong. The texts below are the ones Verify showed (`author/screen-6c.html`); the check descriptions come from drive.py (TASK-NOTES "Checks printed by drive.py").

| # | Field | Saved text | What the check measures | Verdict |
| --- | --- | --- | --- | --- |
| 1 | `oled_cs_ok` | PA3 is configured as GPIO output high to disable the OLED chip select on the shared SPI bus | No SSI0 frame while PA3 is SSI0Fss or driven low | Describes one method, not the behaviour checked |
| 2 | `ldo_errata_ok` | The LDO voltage is raised to 2.75V before enabling the PLL to address the Rev A2 silicon errata | LDOPCTL = 2.75 V before the first PLL power-up (LM3SYSCTL#09, Fury Rev A2) | Matches |
| 3 | `clock_ok` | The clock initialization produces a 50 MHz system clock from the 8 MHz crystal through the PLL | 50 MHz at every UART byte and SSI frame, and never an invalid clock on the way (e.g. PLL selected with the main oscillator disabled) | Says less than the check: a run can reach 50 MHz in QEMU and still fail |
| 4 | `rcgc_delay_ok` | At least 3 system clock cycles must pass after a peripheral's clock is enabled before the peripheral is accessed. | ≥ 3 instructions or a System Control read between an RCGC enable and the module's first access | Matches |
| 5 | `id_clock_ok` | Card identification runs at a frequency between 100 kHz and 400 kHz using an even prescaler value | Identification frames at 100–400 kHz, CPSDVSR even | Matches |
| 6 | `ssi_reconfig_ok` | The SSI module is disabled before reconfiguring clock settings and re-enabled afterward | No SSICR0/SSICPSR write while SSE = 1 | Adds "re-enabled afterward", which this step does not check |
| 7 | `card_io_ok` | Reading and writing work on version 1, standard and high-capacity cards. Every card is addressed correctly, and the UART and SPI speeds are within their limits. | Data and card type on three cards, SD SPI start-up rules, pins, UART and SPI rates | Matches |
| 8 | `reinit_ok` | Each card initialization sequence begins at the slow identification clock rate regardless of previous state. | After a swap to a different card, a second `I` succeeds, identification is again 100–400 kHz, and the new card's data reads correctly | Says less than the check: the new card must also work with its own addressing |

## Wording for 1, 3, 6 and 8 (to adapt in your own words)

- Step 1: While SSI0 sends data to the card, PA3 (the OLED chip select) is never the SSI0 frame signal and is never low.
- Step 3: The system clock is 50 MHz from the 8 MHz crystal through the PLL whenever the UART or SSI is in use, and the chip never runs from a disabled or misconfigured clock on the way there.
- Step 6: SSI0's clock settings (SSICR0 and SSICPSR) are written only while the port is disabled.
- Step 8: When a different card is inserted and initialised again, identification runs at 100–400 kHz again and the new card reads correctly with its own addressing.

Use only if the task is sent back. `scored-steps.json` holds these with the unchanged texts for DOP Builder Helper's Fill (`../../_kit/dop-builder-helper/`).

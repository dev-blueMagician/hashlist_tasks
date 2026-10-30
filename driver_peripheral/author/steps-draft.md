# Scored steps (draft for section 5.1)

Hidden from the model. One step per metric printed by `verifier/drive.py`; every
budget is "equals 1". Equal points. Adapt the wording to the 5.1 form once seen.

1. `card_io_ok` = 1 — Reads and writes the requested blocks on SDHC, SDSC and version 1.x cards, reports the card type, and keeps the UART link (115200 ±2 %) and the data-phase SPI clock (10–25 MHz) within the board's limits.
2. `clock_ok` = 1 — Runs at 50 MHz from the 8 MHz crystal through the PLL, with the main oscillator enabled first; never runs from a disabled or mismatched clock.
3. `ldo_errata_ok` = 1 — Raises the LDO to 2.75 V before powering the PLL (errata LM3SYSCTL#09, revision A2).
4. `id_clock_ok` = 1 — Clocks card identification at 100–400 kHz (even SSICPSR prescaler) on every card type.
5. `ssi_reconfig_ok` = 1 — Changes SSI0's clock settings only while SSE is clear.
6. `oled_cs_ok` = 1 — Keeps the OLED deselected while the SSI transfers: PA3 is neither SSI0Fss nor driven low.
7. `reinit_ok` = 1 — Initialises a swapped-in card again at identification speed and with that card's addressing.
8. `rcgc_delay_ok` = 1 — Waits at least 3 system clocks after enabling a module clock before accessing the module.

End result: all eight hold.

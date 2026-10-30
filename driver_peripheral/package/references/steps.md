Read the board manual first: the card select is PD0, and PA3 is the OLED's chip select on the same SPI bus, so PA3 has to be a plain GPIO held high whenever the card is in use (checked by oled_cs_ok).
Check the errata for revision A2 silicon and raise the LDO to 2.75 V before switching the PLL on (checked by ldo_errata_ok).
Set up the 50 MHz clock the way the datasheet describes for this chip, remembering that the main oscillator is off after reset and has to be turned on before the PLL can use it (checked by clock_ok).
After enabling a peripheral's clock, wait a few cycles before touching that peripheral, as the datasheet asks (checked by rcgc_delay_ok).
Run the card identification at 100-400 kHz, choosing an even prescaler because the hardware ignores its lowest bit (checked by id_clock_ok).
Turn the SPI port off before changing its clock settings and back on afterwards (checked by ssi_reconfig_ok).
Tell old version 1 cards, standard cards and high-capacity cards apart, address each correctly, and keep the UART and SPI speeds within their limits, so reads and writes work on every card (checked by card_io_ok).
Start every initialisation from the slow identification clock and detect the card again, so a newly inserted card works straight away (checked by reinit_ok).

1. Read the board manual first and you will see that the card select is PD0, and PA3 is the OLED's chip select on the same SPI bus, which means that PA3 must be set as GPIO high when the card is active (check oled_cs_ok).
2. Then calculate the silicon revision from the DID0 value in the service log (A2), look into the errata for that and increase the LDO to 2.75 V before turning on the PLL (check ldo_errata_ok).
3. Set up the 50 MHz clock according to the description in the datasheet noting that the main oscillator is disabled after reset and thus has to be enabled in order for the PLL to use it (check clock_ok).
4. Wait several cycles after clock enable of any peripheral according to the request in the datasheet (check rcgc_delay_ok).
5. Run the card identification at frequencies from 100 to 400 kHz using even prescaler value since the hardware does not care about the lowest bit (check id_clock_ok).
6. Turn the SPI port off before changing its clock settings and then enable it (check ssi_reconfig_ok).
7. Distinguish between old version 1 cards, standard cards and high capacity cards, address all of them accordingly and make sure that UART and SPI rates stay within their allowed limits to ensure proper reading and writing on all cards (check card_io_ok).
8. Begin each initialization from slow identification clock and detect the card again, so that the new card will work straight away (check reinit_ok).
9. Answer a block number beyond the end of the card with an error for all types of cards. On a byte-addressed card, block 2^23 or higher would overflow the 32-bit address and reach a low block, so test for that before the command goes out (check range_ok).
10. Test on a card of the same size as the ones in the service log, not only a small one. A write line with an eight-digit block number is longer than the prototype's line buffer, so those writes fail until the buffer is made big enough for a ten-digit block number (check large_card_ok).

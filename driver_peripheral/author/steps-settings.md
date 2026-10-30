# Settings for the scored steps on 5.4

Each step: "Checked by" = **a value between**, lowest = 1, highest = 1, Worth = 1.
"Mistakes that get it wrong": naive_a on or off as listed (from probe 4: naive_a passes only rcgc_delay_ok).
Delete the ninth generated step (the one about LBA overflow protection, or whichever is left over).

| Step text | Field | naive_a gets it wrong |
| --- | --- | --- |
| PA3, the OLED chip select, is never SSI0Fss or driven low while the SPI port transfers | `oled_cs_ok` | on |
| The LDO is raised to 2.75 V before the PLL is powered up (errata LM3SYSCTL#09) | `ldo_errata_ok` | on |
| The system clock is 50 MHz from the 8 MHz crystal through the PLL, with the main oscillator enabled and a valid clock at every step | `clock_ok` | on |
| At least 3 system clocks pass between a module clock enable and the first access to that module | `rcgc_delay_ok` | off |
| Card identification runs at 100-400 kHz with an even prescaler | `id_clock_ok` | on |
| SSI0's clock settings are changed only while the port is disabled | `ssi_reconfig_ok` | on |
| SDHC, SDSC and version 1.x cards read and write correctly, with the UART and SPI speeds within their limits | `card_io_ok` | on |
| A card swapped in and initialised again works at identification speed and with its own addressing | `reinit_ok` | on |

After the edits, "End result — what the checks accept" should list exactly these eight fields, each "1 to 1".

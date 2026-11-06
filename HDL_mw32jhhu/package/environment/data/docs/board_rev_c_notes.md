# Line card rev C: hardware notes for FPGA designers

Extract of the rev C design notes. Items that do not concern the packet buffer are left out.

## Clocks

| Net | Frequency | Source | Used by |
| --- | --- | --- | --- |
| CLK_CORE | 125.00 MHz | PLL1 out 0 | FPGA core, `pktbuf` `clk` |
| SRAM_CLK | 125.00 MHz | PLL1 out 1, phase aligned to CLK_CORE | U12 CLK |

## Buffer SRAM (U12)

U12 is the NW61P1024 (rev B: NW61F1024). Pins as on rev B:

| FPGA signal | U12 pin |
| --- | --- |
| `sram_ce_n` | CE# |
| `sram_we_n` | WE# |
| `sram_addr[9:0]` | A[9:0] |
| `sram_wdata[31:0]` | D[31:0] |
| `sram_rdata[31:0]` | Q[31:0] |

The `pktbuf` SRAM ports connect straight to the FPGA pins; the FPGA I/O has no input or output registers on these signals. Board delays are within one cycle at 125 MHz, so the edges in the U12 datasheet are `pktbuf` clock edges.

### Straps (schematic rev C, sheet 7, as released 2026-06-10)

| Pin | Network | Level |
| --- | --- | --- |
| U12 LAT | R40 10k to GND fitted, R41 10k to VDDQ not fitted | L |

## Bring-up log (excerpt)

| Date | Board | Note |
| --- | --- | --- |
| 2026-08-19 | SN 0003 | FPGA configures, PLL1 locks. SRAM read/write with the rev B `pktbuf` fails as expected (rev B timing). |
| 2026-08-21 | SN 0007 | SRAM march test from the debug core at 125 MHz: 0.3 % read errors, random bits, all addresses. Same test at 100 MHz passes. |
| 2026-08-28 | SN 0007 | Errors traced to the LAT strap: 125 MHz is above the LAT = L limit in the U12 datasheet. |
| 2026-09-02 | all | ECO-117 released: on every rev C board, R40 removed and R41 fitted. March test at 125 MHz passes on SN 0003, 0007, 0011. Schematic to be updated at rev D. |
| 2026-09-03 | SN 0007 | SRAM exerciser v0.3 from the debug core at 125 MHz, driving the `pktbuf` SRAM ports. ILA capture of those ports in `ila_sram_sn0007.csv`, one row per clock edge (the values at that edge). Steps: 1 write 0x000–0x00F with pattern A; 2 read 0x000–0x00F back; 3 write 0x000–0x00F with pattern B; 4 for k = 0 to 4 idle cycles, write three addresses with pattern C, each followed by k idle cycles and a read of the same address. Steps 1–3 compare OK. Step 4 has no compare yet; capture kept for review. |

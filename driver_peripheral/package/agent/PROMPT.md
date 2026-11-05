Our data logger is built on the EK-LM3S6965 evaluation board. Its firmware, `/app/firmware.c`, serves the board's microSD card to a host over UART0 (the virtual COM port). The header comment in that file describes the host protocol, and the host software depends on it.

The firmware is still the bench prototype, and 30 pilot units are running it. Some have worked for weeks and others can't be used at all. What the service desk has so far, including a capture from a returned unit, is in `/app/data/service-log.txt`. Nobody has reproduced any of it here.

Bring the firmware up to the product requirements:

- System clock 50 MHz from the board's 8 MHz crystal through the PLL.
- UART0 at 115200 baud, 8N1, within ±2 % on every unit.
- The microSD card in SPI mode on SSI0, wired as on the board. Card identification at 100–400 kHz, data transfers at 10–25 MHz.
- SDSC, SDHC and version 1.x cards, including a card swapped in and initialised again with `I`.

The board documentation is in `/app/files`: the LM3S6965 datasheet, the Stellaris errata (SPMZ860) and the EK-LM3S6965 user's manual. `pdftotext` is installed. The QEMU board model executes the firmware but does not model the clock tree, bus timing or pin functions.

Build with the same command the release build uses:

    cd /app
    mkdir -p build && cd build
    arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -Os -ffreestanding -fno-tree-loop-distribute-patterns -nostdlib -I/app/data -T /app/data/link.ld /app/data/start.c /app/firmware.c -lgcc -o firmware.elf

Run with a card in the slot: `sh /app/data/run-sd.sh firmware.elf card.img [v1]`. Its header explains the card images and types. `/app/data/run.sh` runs the board without a card.

Deliver the corrected `/app/firmware.c`. Only that file is collected; keep `app_main` and the host protocol.

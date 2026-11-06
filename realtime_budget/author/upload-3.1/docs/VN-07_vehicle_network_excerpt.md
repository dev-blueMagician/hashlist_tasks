# VN-07 Vehicle network specification, powertrain CAN (excerpt for suppliers)

Version 4.1. Sections relevant to receiving nodes.

## 3 Physical and data link layer

3.1 Bit rate 500 kbit/s, ISO 11898-2. Standard 11-bit identifiers only.

3.4 Every data frame on this network carries 8 data bytes (DLC = 8); unused bytes are padded.

## 4 Bus load

4.2 A node shall work correctly at any bus load up to 100 %, frames sent back to back.

4.5 Identifiers 0x700 to 0x7FF are reserved for diagnostics. While an ECU on the network is reprogrammed, diagnostic frames may occupy the bus back to back for the length of a transfer; testers may use a separation time STmin of 0.

## 5 Timing

5.1 An 8-byte standard data frame is 108 bits plus 3 bits intermission, 111 bit times, without stuff bits, and up to 135 bit times with worst-case bit stuffing.

5.3 Receivers shall not rely on the transmission period of a message for their own timing.

# Fleet reset log

`reset_log_3.2.0.csv` lists every reset freeze frame read back from the fleet since 3.2.0 was rolled out (about 2 400 pumps, OTA update completed 2026-07-14). No reset of this kind was reported on 3.1.0.

| column | meaning |
| --- | --- |
| `timestamp_utc` | time of the reset, from the telematics unit |
| `unit_serial` | pump serial number |
| `reset_cause` | `TMON_OVERRUN` (tmon.c, budget exceeded) or `IWDG` (RCC_CSR IWDGRSTF set at start-up) |
| `task` | task whose budget was exceeded (TMON only) |
| `tmon_measured_us` | TMON measurement at the overrun, converted at 168 cycles per us |
| `tmon_budget_us` | budget in force (os_cfg.c) |
| `can_rx_frames_last_100ms` | CAN1 FIFO 0 receptions in the 100 ms before the reset |
| `lsi_hz` | LSI frequency measured by this unit at start-up (`lsi_measure()`, diagnostic only) |
| `operating_hours` | pump operating hours |

The telematics unit reports no other fault at these times. Several resets match vehicle workshop visits or OTA campaigns for other ECUs.

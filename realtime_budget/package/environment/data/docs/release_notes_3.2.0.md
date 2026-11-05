# ECP-300 software 3.2.0 release notes

Released 2026-07-06 to production and fleet over-the-air update.

## New

- Functional diagnostic requests (CAN ID 0x7DF) are accepted, for DTC read-out by the fleet telematics unit.
- NvM stores a freeze frame with each new DTC.

## Changed

- CAN: `can_legacy.c` replaced by `can_if_glue.c` and the supplier CanIf 4.2 stack. Reception in interrupt mode.
- Monitor: derating table extended up to 5200 rpm.
- SpeedCtrl: observer rewritten, shorter execution time.

## Timing (TAG-01 review, 2026-06-18)

- Reference traces: `bench_nominal_2400rpm`, `bench_maxspeed_5200rpm`, `service_bay_ecm_reflash`.
- The largest monitored times in the reference traces are within the 3.1.0 budgets. Budgets, priorities and the IWDG setting are carried over from 3.1.0 unchanged.

## Known issues

- None at release.

# SRS-ECP300 Software requirements, timing and watchdog (excerpt)

ECP-300 electric coolant pump controller, 12 V, 300 W. Revision F, 2025-01-20.

## Operating conditions

- Ambient temperature -40 to +105 °C (STM32F405RGT7, temperature range 7), supply 9 to 16 V.
- The controller is connected to the vehicle bus and shall meet every requirement of VN-07 (vehicle network specification) under all bus conditions VN-07 allows.
- Requirements apply to every unit produced, over the full tolerance of its components.

## Tasks

| Task | Period T_i | Deadline D_i | Function |
| --- | --- | --- | --- |
| SpeedCtrl | 1 ms | 1 ms | speed PI controller, flux observer, setpoint ramp |
| CanComm | 5 ms | 5 ms | CanIf main function, diagnostics (Dcm), transmission |
| Monitor | 10 ms | 10 ms | temperatures, DC-link voltage, derating, DTC debouncing |
| Supervisor | 20 ms | 20 ms | alive supervision of the other tasks, watchdog refresh |
| NvM | 100 ms | 100 ms | EEPROM emulation, DTC and freeze-frame storage |

Periods and deadlines are fixed by this SRS.

## Timing requirements

- **SR-TIM-01** Every task shall complete each job within its deadline.
- **SR-TIM-02** Every task shall be monitored by TMON with a budget greater than zero.
- **SR-TIM-03** A fault-free job shall not exceed its TMON budget under any condition of this SRS.
- **SR-TIM-04** A TMON budget shall be at most 25 % above the largest monitored time of a fault-free job, so that a runaway job is stopped within the fault tolerant time of the speed loop.
- **SR-TIM-05** Budgets, priorities and the IWDG setting shall be derived with TAG-01.

## Watchdog requirements

- **SR-WDG-01** The independent watchdog shall not expire in fault-free operation.
- **SR-WDG-02** If the Supervisor stops refreshing it, the independent watchdog shall reset the controller within 80 ms.

## Reaction to a reset

After a TMON overrun or a watchdog reset the pump stops for about 300 ms (start-up and rotor alignment), and a reset freeze frame is stored. Field resets are reported in the fleet reset log.

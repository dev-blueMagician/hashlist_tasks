The TSN software team needs launch-time scheduling in the MAC's transmit scheduler, txsched. Today software holds time-critical frames back and queues each one just in time from a timer interrupt, and the frames still leave with tens of microseconds of jitter. The change is approved as ECR-0731: software will queue a frame early, with the tick at which it may leave, and txsched releases it at that tick, earliest launch time first, and drops frames that have become too late.

Implement ECR-0731 in the rev A design.

In /app/data:

- `txsched.v`, `txsched_timebase.v`, `txsched_fifo.v`, `txsched_rr.v`: the rev A RTL.
- `docs/txsched_spec.md`: the rev A block specification.
- `docs/ECR-0731_launch_time.md`: the change request.
- `tb/tb_smoke.v` and `Makefile`: the rev A smoke test. `make -s -C /app/data` runs it on Icarus Verilog, and `make -s -C /app/data verilator` on Verilator. It covers rev A behaviour only.

Change the four design files in place. Keep the module `txsched` with its ports and parameters, and keep every module in those four files, which are the only ones delivered. The RTL must be synthesizable as the ECR's Delivery section describes. Icarus Verilog 13, Verilator 5.048 and make are installed.

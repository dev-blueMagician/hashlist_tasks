# txsched smoke test (rev A behaviour, default parameters).
#   make            Icarus Verilog
#   make verilator  the same bench on Verilator, random power-up state
#   make clean
# Exits non-zero unless the bench prints SMOKE PASS.

SRC   = txsched.v txsched_timebase.v txsched_fifo.v txsched_rr.v
TB    = tb/tb_smoke.v
BUILD = build

.PHONY: all sim verilator clean

all: sim

sim: $(SRC) $(TB)
	@mkdir -p $(BUILD)
	@iverilog -g2012 -o $(BUILD)/smoke.vvp -s tb_smoke $(SRC) $(TB)
	@vvp -n $(BUILD)/smoke.vvp | tee $(BUILD)/smoke.log
	@grep -q "SMOKE PASS" $(BUILD)/smoke.log

verilator: $(SRC) $(TB)
	@mkdir -p $(BUILD)
	@verilator --binary --timing -Wno-fatal -Wno-lint -Wno-style --timescale 1ns/1ps \
		--x-initial unique --x-assign unique --top-module tb_smoke \
		-Mdir $(BUILD)/vl -o vsim $(SRC) $(TB) > $(BUILD)/verilator.log 2>&1 \
		|| (tail -20 $(BUILD)/verilator.log; exit 1)
	@$(BUILD)/vl/vsim +verilator+rand+reset+2 | tee $(BUILD)/smoke_vl.log
	@grep -q "SMOKE PASS" $(BUILD)/smoke_vl.log

clean:
	@rm -rf $(BUILD)

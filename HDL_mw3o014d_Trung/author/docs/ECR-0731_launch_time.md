# ECR-0731: launch-time scheduling in txsched (rev B)

Engineering change request. Raised by: TSN software team. Block: txsched (`docs/txsched_spec.md`, rev A). Status: approved for implementation.

## Why

Time-sensitive streams on the industrial ports have to leave the MAC at a set time, not as soon as they are queued. Software now holds such frames back and queues each one just in time, which costs a timer interrupt per frame and still jitters by tens of microseconds. Rev B moves the launch decision into txsched: software queues a frame early with the tick at which it may leave, and txsched releases it then.

The ports and parameters for this were reserved in rev A (`in_lt_en`, `in_lt`, `LATE_WIN`, `late_mask`, `late_cnt`). The top-level ports and parameters do not change.

## The change

### 1. Two kinds of frame

A descriptor queued with `in_lt_en` low is a best-effort frame and behaves as in rev A. A descriptor queued with `in_lt_en` high is a scheduled frame; `in_lt` is its launch time, a value of the tick counter `now`. The launch time is captured with the descriptor. `in_lt` is ignored for best-effort frames.

A channel may hold both kinds. Each channel still offers only its head descriptor, and descriptors leave a channel (appear or are dropped) in the order they were queued.

### 2. Launch time

A scheduled frame must not appear on the output (spec section 6: in the cycle after it is taken) before its launch time: it may appear only in a cycle in which `now` is at or after its launch time.

The output stage stays work-conserving: a scheduled frame at the head of its channel may be taken as soon as appearing in the next cycle would respect its launch time and it is not late (section 4). Whether it is taken then depends on the stage being free, `pause` being low and the priority in section 3, as in rev A.

### 3. Priority

When the stage takes a descriptor:

1. Scheduled frames that may be taken go first. Among them the one with the earliest launch time goes first, which is the one that would appear the most ticks after its launch time. Equal launch times go in round-robin order (spec section 6).
2. If no scheduled frame may be taken, best-effort frames go in round-robin order, as in rev A.

The round-robin position moves to the channel taken, whichever kind of frame it was. `out_gts` is unchanged: the value of `now` in the cycle the frame was taken.

A scheduled frame at a channel's head that may not be taken yet blocks that channel. Frames behind it, of either kind, wait.

### 4. Late frames

A scheduled frame is late if it would appear LATE_WIN or more ticks after its launch time. A late frame never appears. Instead, at the end of every cycle in which `pause` is low, each channel whose head frame would be late if it appeared in the next cycle drops that frame, whether or not the output stage is free. The next descriptor in that channel becomes its head in the next cycle.

- `late_mask` bit ch is high for one cycle, the cycle after channel ch dropped a frame, and low otherwise.
- `late_cnt` counts every dropped frame, in all channels together, wrapping from 65535 to 0. It changes in the cycle after the drop, and reset clears it.

While `pause` is high, nothing is taken and nothing is dropped.

### 5. The counter wraps

`now` wraps from 2^TS_W − 1 to 0, and so do launch times. Software keeps every queued launch time within 2^(TS_W−1) − 1 ticks of `now`, before or after, at all times, and also across `ts_set` steps. LATE_WIN is at most 2^(TS_W−2). "At or after", "before" and "ticks after" in this ECR are meant on the wrapping counter in that sense: a launch time 3 ticks behind `now` is in the past even if `now` has just wrapped to 1.

### 6. Pause and time steps

`pause` and `ts_set` keep their rev A meaning (spec section 4). Launch times are values of `now`, so a time step moves every queued frame's launch time relative to `now` with it: a step forward can make frames due or late at once, and a step backward can make a frame that was due wait again. A frame that is in the output stage stays there until it is accepted.

### 7. Unchanged

- With best-effort traffic only, rev B behaves exactly as rev A, cycle for cycle.
- Reset, the enqueue rules, the output stage handshake and the time base are as in rev A.

## Parameters and ranges

All parameters keep the ranges in spec section 2, and rev B must work at every combination. `LATE_WIN` takes effect in rev B.

## Delivery

Change the design files in `/app/data`: `txsched.v`, `txsched_timebase.v`, `txsched_fifo.v` and `txsched_rr.v`. Keep the module name `txsched` and its ports and parameters. Only these four files are delivered, so any new module goes in one of them. The RTL must be synthesizable: no `initial`, no delays, no system tasks other than `$clog2`, `$signed` and `$unsigned`, no macros or `` `include ``, no hierarchical references, no register given a value where it is declared, and every event control `@*` or a list of `posedge`/`negedge` edges.

The rev A smoke test (`make -s -C /app/data`) must still pass. It does not cover rev B.

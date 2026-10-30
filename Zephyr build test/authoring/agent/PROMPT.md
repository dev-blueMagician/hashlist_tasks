In the supplied starter, non-empty UART batches produce incomplete summaries.
Empty batches return normally.

Investigate `/app/data/task/firmware/pipeline.c` and correct it to meet the
contract above `pipeline_drain()`. Keep the function signature and the UART protocol
unchanged. Make the fix in `pipeline.c`; leave the other supplied files intact.

Leave the repaired source at its original path.

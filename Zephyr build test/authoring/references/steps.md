Build and link the firmware with the supplied startup code and linker script.
Run it on QEMU and confirm it reaches the UART ready message.
Check that each UART request receives one complete response.
Reset the item count and include every value removed from the queue.
Reset the sum and add every removed value using uint32 arithmetic.
Start the order checksum at zero and update it in FIFO order.
Keep draining until the queue is empty.
Return success when the drain finishes, including an initially empty queue.

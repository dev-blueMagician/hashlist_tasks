#include "pipeline.h"
#include <zephyr/sys/printk.h>

K_MSGQ_DEFINE(smoke_queue, sizeof(uint32_t), 8, 4);

static int run_case(const char *name, const uint32_t *values, uint32_t count)
{
    struct pipeline_result result = {0xdeadbeefU, 0xdeadbeefU, 0xdeadbeefU};

    k_msgq_purge(&smoke_queue);
    for (uint32_t i = 0; i < count; ++i) {
        if (k_msgq_put(&smoke_queue, &values[i], K_NO_WAIT) != 0) {
            printk("ZEPHYR_SMOKE_SETUP_ERROR\n");
            return -1;
        }
    }

    int rc = pipeline_drain(&smoke_queue, &result);

    printk("CASE %s count=%u sum=%u order=%u remaining=%u rc=%d\n",
           name, (unsigned int)result.count, (unsigned int)result.sum,
           (unsigned int)result.order,
           (unsigned int)k_msgq_num_used_get(&smoke_queue), rc);
    return 0;
}

int main(void)
{
    static const uint32_t example[] = {3U, 1U, 4U, 1U, 5U, 9U};

    printk("ZEPHYR_SMOKE_BEGIN v1\n");
    if (run_case("example", example, 6U) != 0 ||
        run_case("empty", example, 0U) != 0) {
        return 1;
    }
    printk("ZEPHYR_SMOKE_END v1\n");
    /* The grader stops QEMU after this final line; main returning alone does
     * not promise that the emulator process exits.
     */
    return 0;
}


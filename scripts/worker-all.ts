import { CronTaskCenter } from "../app/modules/deployment/cron-task-center.server";
import { createImportWorker } from "../app/modules/import-orchestrator/import-worker.server";
import { getRuntimeConfig } from "../app/modules/runtime-config.server";

async function main() {
  const config = getRuntimeConfig();
  console.log(`Paperasse worker starting. import=${config.importExecutionMode} cron=${config.cronMode}`);
  if (config.cronMode !== "disabled") {
    const cron = new CronTaskCenter(config);
    await cron.cleanupTemporaryWorkdirs();
    await cron.runRegulatoryFreshnessCheck().catch((error) => console.error("regulatory freshness failed", error));
    await cron.refreshFiscalDeadlineNotifications().catch((error) => console.error("notification refresh failed", error));
  }
  if (config.importExecutionMode === "bullmq") {
    const worker = createImportWorker(config);
    worker.on("completed", (job) => console.log(`Import job completed: ${job.id}`));
    worker.on("failed", (job, error) => console.error(`Import job failed: ${job?.id ?? "unknown"} ${error.message}`));
    return;
  }
  console.log("BullMQ import worker inactive. Set IMPORT_EXECUTION_MODE=bullmq to process import jobs.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

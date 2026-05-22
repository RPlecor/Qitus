import "../app/modules/env.server";
import { createImportWorker } from "../app/modules/import-orchestrator/import-worker.server";

const worker = createImportWorker();

worker.on("completed", (job) => {
  console.log(`Import job completed: ${job.id}`);
});

worker.on("failed", (job, error) => {
  console.error(`Import job failed: ${job?.id ?? "unknown"} ${error.message}`);
});

console.log("Paperasse import worker started.");

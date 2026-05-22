import { Worker } from "bullmq";
import { getRuntimeConfig, type RuntimeConfig } from "../runtime-config.server";
import { createRedisConnection, type ImportExecutionRequest } from "./import-executor.server";
import { ImportOrchestrator } from "./import-orchestrator.server";

export function createImportWorker(config: RuntimeConfig = getRuntimeConfig()) {
  const orchestrator = new ImportOrchestrator({ config });
  return new Worker<ImportExecutionRequest>(
    "qitus-imports",
    async (job) => {
      await orchestrator.runImportJob(job.data);
    },
    { connection: createRedisConnection(config), concurrency: 1 }
  );
}

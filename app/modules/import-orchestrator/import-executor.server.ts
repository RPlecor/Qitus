import { Queue } from "bullmq";
import IORedis from "ioredis";
import { getRuntimeConfig, type RuntimeConfig } from "../runtime-config.server";

export type ImportJobStep = "detect-and-parse" | "categorize";

export type ImportExecutionRequest = {
  importId: string;
  step: ImportJobStep;
};

export type ImportExecutionResult = {
  mode: "inline" | "bullmq";
  importId: string;
  queued: boolean;
  jobId?: string;
};

export interface ImportExecutor {
  execute(request: ImportExecutionRequest): Promise<ImportExecutionResult>;
}

export interface ImportRunner {
  runImportJob(request: ImportExecutionRequest): Promise<void>;
}

type QueueLike = {
  add(name: string, data: ImportExecutionRequest, options: Record<string, unknown>): Promise<{ id?: string }>;
  close(): Promise<void>;
};

export class InlineImportExecutor implements ImportExecutor {
  constructor(private readonly runner: ImportRunner) {}

  async execute(request: ImportExecutionRequest): Promise<ImportExecutionResult> {
    await this.runner.runImportJob(request);
    return { mode: "inline", importId: request.importId, queued: false };
  }
}

export class BullMqImportExecutor implements ImportExecutor {
  constructor(private readonly options: { config?: RuntimeConfig; queueFactory?: () => QueueLike } = {}) {}

  async execute(request: ImportExecutionRequest): Promise<ImportExecutionResult> {
    const queue = this.options.queueFactory?.() ?? createImportQueue(this.options.config);
    try {
      const job = await queue.add(request.step, request, {
        jobId: `${request.importId}:${request.step}`,
        attempts: 1,
        removeOnComplete: 100,
        removeOnFail: 100,
      });
      return { mode: "bullmq", importId: request.importId, queued: true, jobId: job.id };
    } catch (error) {
      throw new Error(`Redis/BullMQ indisponible pour IMPORT_EXECUTION_MODE=bullmq: ${errorMessage(error)}`);
    } finally {
      await queue.close();
    }
  }
}

export function createImportQueue(config: RuntimeConfig = getRuntimeConfig()) {
  return new Queue("paperasse-imports", { connection: createRedisConnection(config) });
}

export function createRedisConnection(config: RuntimeConfig = getRuntimeConfig()) {
  return new IORedis(config.redisUrl, { maxRetriesPerRequest: null });
}

export function importExecutionMode(config: RuntimeConfig = getRuntimeConfig()): "inline" | "bullmq" {
  if (config.importExecutionMode === "inline") return "inline";
  if (config.importExecutionMode === "bullmq") return "bullmq";
  return config.redisUrl ? "bullmq" : "inline";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

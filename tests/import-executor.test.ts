import { describe, expect, it } from "vitest";
import {
  BullMqImportExecutor,
  importExecutionMode,
  InlineImportExecutor,
  type ImportRunner,
} from "../app/modules/import-orchestrator/import-executor.server";
import { getRuntimeConfig } from "../app/modules/runtime-config.server";

describe("ImportExecutor", () => {
  it("runs inline imports immediately through the runner", async () => {
    const calls: unknown[] = [];
    const runner: ImportRunner = {
      async runImportJob(request) {
        calls.push(request);
      },
    };

    const result = await new InlineImportExecutor(runner).execute({ importId: "imp_1", step: "detect-and-parse" });

    expect(calls).toEqual([{ importId: "imp_1", step: "detect-and-parse" }]);
    expect(result).toMatchObject({ mode: "inline", queued: false });
  });

  it("enqueues BullMQ imports without running business logic", async () => {
    const jobs: unknown[] = [];
    const executor = new BullMqImportExecutor({
      queueFactory: () => ({
        async add(name, data, options) {
          jobs.push({ name, data, options });
          return { id: "job_1" };
        },
        async close() {},
      }),
    });

    const result = await executor.execute({ importId: "imp_1", step: "categorize" });

    expect(jobs).toEqual([{
      name: "categorize",
      data: { importId: "imp_1", step: "categorize" },
      options: expect.objectContaining({ jobId: "imp_1:categorize", attempts: 1 }),
    }]);
    expect(result).toMatchObject({ mode: "bullmq", queued: true, jobId: "job_1" });
  });

  it("keeps inline as the default execution mode", () => {
    expect(importExecutionMode({
      ...getRuntimeConfig({ DATABASE_URL: "postgresql://localhost:5432/paperasse" }),
      authMode: "dev",
      databaseUrl: "postgresql://localhost:5432/paperasse",
      aiProvider: "codex-cli",
      codexCliBin: "codex",
      codexModel: "gpt-5.4-mini",
      openAiModel: "gpt-4o-mini",
      openAiApiKey: undefined,
      clerkPublishableKey: undefined,
      clerkSecretKey: undefined,
      clerkWebhookSecret: undefined,
      paperasseRepoPath: "./vendor/paperasse",
      documentStorageDir: "storage/documents",
      enablePdfGeneration: false,
      importExecutionMode: "inline",
      redisUrl: "redis://localhost:6379",
      billingMode: "stub",
      stripeSecretKey: undefined,
      stripeWebhookSecret: undefined,
      stripePriceSolo: undefined,
      stripePriceEntreprise: undefined,
      stripePriceEntreprisePlus: undefined,
      chatProvider: "codex-cli",
      chatModel: "gpt-5.4-mini",
    })).toBe("inline");
  });
});

import { stat } from "node:fs/promises";
import IORedis from "ioredis";
import { prisma } from "../db.server";
import { createDocumentStorageAdapter } from "../documents/document-storage-adapter.server";
import { createEvidenceStorageAdapter } from "../evidence/evidence-storage-adapter.server";
import { DeploymentRuntimeCenter } from "./deployment-runtime-center.server";
import { getRuntimeConfig, type RuntimeConfig } from "../runtime-config.server";

export type DependencyStatus = {
  name: string;
  status: "ok" | "warning" | "error" | "skipped";
  message: string;
};

export class HealthCheckCenter {
  constructor(private readonly config: RuntimeConfig = getRuntimeConfig()) {}

  getLiveness() {
    return { status: "ok" as const, checkedAt: new Date().toISOString() };
  }

  async getReadiness() {
    const dependencies = await this.getDependencyStatus();
    const errors = dependencies.filter((dependency) => dependency.status === "error");
    return {
      status: errors.length === 0 ? "ready" as const : "not_ready" as const,
      checkedAt: new Date().toISOString(),
      dependencies,
    };
  }

  async assertReadyForTraffic() {
    const readiness = await this.getReadiness();
    if (readiness.status !== "ready") {
      throw new Error(readiness.dependencies.filter((item) => item.status === "error").map((item) => `${item.name}: ${item.message}`).join("; "));
    }
    return readiness;
  }

  async getDependencyStatus(): Promise<DependencyStatus[]> {
    const runtime = new DeploymentRuntimeCenter(this.config).getRuntimeReport();
    const checks = await Promise.all([
      Promise.resolve(runtime.status === "ready"
        ? ok("runtime", "Configuration runtime valide.")
        : error("runtime", runtime.errors.join(" "))),
      check("database", async () => {
        await prisma.$queryRaw`SELECT 1`;
        return "PostgreSQL répond.";
      }),
      check("qitus_runtime", async () => {
        await stat(this.config.paperasseRepoPath);
        return "Runtime documentaire Qitus disponible.";
      }),
      this.config.importExecutionMode === "bullmq" || this.config.cronMode === "worker"
        ? this.checkRedis()
        : Promise.resolve(skipped("redis", "Redis non requis par la configuration actuelle.")),
      this.checkStorage(),
      Promise.resolve(this.openBankingStatus()),
    ]);
    return checks;
  }

  private async checkRedis(): Promise<DependencyStatus> {
    const redis = new IORedis(this.config.redisUrl, { maxRetriesPerRequest: 1, lazyConnect: true });
    try {
      await redis.connect();
      await redis.ping();
      return ok("redis", "Redis répond.");
    } catch (err) {
      return error("redis", err instanceof Error ? err.message : "Redis indisponible.");
    } finally {
      redis.disconnect();
    }
  }

  private async checkStorage(): Promise<DependencyStatus> {
    try {
      createDocumentStorageAdapter(this.config);
      createEvidenceStorageAdapter(this.config);
      return ok("storage", this.config.objectStorageMode === "s3" ? "Stockage S3 configuré." : "Stockage local configuré.");
    } catch (err) {
      return error("storage", err instanceof Error ? err.message : "Stockage indisponible.");
    }
  }

  private openBankingStatus(): DependencyStatus {
    if (this.config.openBankingProvider === "disabled") return skipped("open_banking", "Open Banking désactivé.");
    if (this.config.openBankingProvider === "mock") return ok("open_banking", "Provider Open Banking mock actif.");
    const webhookOk = this.config.openBankingProvider === "gocardless" || Boolean(this.config.openBankingWebhookSecret);
    const baseOk = this.config.openBankingProvider !== "powens" || Boolean(this.config.openBankingBaseUrl);
    const vaultOk = this.config.appEnv === "local" || this.config.openBankingProvider === "gocardless" || Boolean(this.config.providerSecretEncryptionKey);
    const configured = Boolean(this.config.openBankingClientId && this.config.openBankingClientSecret && webhookOk && baseOk && vaultOk);
    return configured ? ok("open_banking", "Provider Open Banking configuré.") : error("open_banking", "Configuration Open Banking incomplète.");
  }
}

function check(name: string, fn: () => Promise<string>): Promise<DependencyStatus> {
  return fn().then((message) => ok(name, message)).catch((err) => error(name, err instanceof Error ? err.message : String(err)));
}

function ok(name: string, message: string): DependencyStatus {
  return { name, status: "ok", message };
}

function skipped(name: string, message: string): DependencyStatus {
  return { name, status: "skipped", message };
}

function error(name: string, message: string): DependencyStatus {
  return { name, status: "error", message };
}

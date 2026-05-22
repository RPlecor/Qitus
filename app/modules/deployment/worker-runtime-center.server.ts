import { getRuntimeConfig, type RuntimeConfig } from "../runtime-config.server";

export class WorkerRuntimeCenter {
  constructor(private readonly config: RuntimeConfig = getRuntimeConfig()) {}

  getWorkerStatus() {
    const importWorkerRequired = this.config.importExecutionMode === "bullmq" || this.config.importExecutionMode === "auto";
    return {
      mode: this.config.importExecutionMode,
      required: importWorkerRequired,
      status: importWorkerRequired ? "external_required" as const : "not_required" as const,
      queue: "imports",
      redisConfigured: Boolean(this.config.redisUrl),
      message: importWorkerRequired
        ? "Un worker d'import doit être lancé avec npm run worker:imports ou npm run worker:all."
        : "Les imports tournent inline dans cette configuration locale.",
    };
  }

  getCronStatus() {
    return {
      mode: this.config.cronMode,
      required: this.config.cronMode === "worker",
      status: this.config.cronMode === "disabled" ? "disabled" as const : "configured" as const,
      tasks: ["regulatory_freshness", "notifications", "cleanup_workdirs"],
      workdirCleanupMaxAgeMinutes: this.config.workdirCleanupMaxAgeMinutes,
      message: this.config.cronMode === "worker"
        ? "Les tâches cron doivent tourner dans un worker."
        : this.config.cronMode === "local"
          ? "Les tâches cron peuvent tourner localement."
          : "Cron désactivé.",
    };
  }

  getRuntimeStatus() {
    return {
      worker: this.getWorkerStatus(),
      cron: this.getCronStatus(),
    };
  }
}

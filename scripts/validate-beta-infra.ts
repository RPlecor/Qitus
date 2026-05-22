import { getDevCompanyWorkspace } from "../app/modules/company-workspace/company-workspace.server";
import { BetaReadinessCenter } from "../app/modules/deployment/beta-readiness-center.server";
import { MetricCatalog } from "../app/modules/deployment/metric-catalog.server";
import { WorkerRuntimeCenter } from "../app/modules/deployment/worker-runtime-center.server";
import { StorageAuditCenter } from "../app/modules/storage/storage-audit-center.server";

async function main() {
  const workspace = await getDevCompanyWorkspace();
  const [readiness, storageAudit, workers, metrics] = await Promise.all([
    new BetaReadinessCenter().getReadiness(workspace),
    new StorageAuditCenter().getStorageAudit(workspace),
    Promise.resolve(new WorkerRuntimeCenter().getRuntimeStatus()),
    Promise.resolve(new MetricCatalog().assertRequiredMetricsPresent()),
  ]);
  console.log(JSON.stringify({ readiness, storageAudit: storageAudit.summary, workers, metrics }, null, 2));
  if (readiness.status === "blocked") throw new Error("Beta readiness bloquée.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

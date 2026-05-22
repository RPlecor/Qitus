import { DeploymentRuntimeCenter } from "../app/modules/deployment/deployment-runtime-center.server";
import { HealthCheckCenter } from "../app/modules/deployment/health-check-center.server";
import { StorageConfigurationCenter } from "../app/modules/deployment/storage-configuration-center.server";

async function main() {
  const runtime = new DeploymentRuntimeCenter().getRuntimeReport();
  const readiness = await new HealthCheckCenter().getReadiness();
  const storage = new StorageConfigurationCenter().getStatus();
  console.log(JSON.stringify({ runtime, readiness, storage }, null, 2));
  if (runtime.status !== "ready") process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

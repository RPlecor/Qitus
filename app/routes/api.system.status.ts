import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { HealthCheckCenter } from "~/modules/deployment/health-check-center.server";
import { DeploymentRuntimeCenter } from "~/modules/deployment/deployment-runtime-center.server";
import { SecurityHardeningCenter } from "~/modules/deployment/security-hardening-center.server";
import { WorkerRuntimeCenter } from "~/modules/deployment/worker-runtime-center.server";

export async function loader(args: LoaderFunctionArgs) {
  await requireCompanyWorkspace(args);
  const [readiness, runtime] = await Promise.all([
    new HealthCheckCenter().getReadiness(),
    Promise.resolve(new DeploymentRuntimeCenter().getRuntimeReport()),
  ]);
  return json({
    readiness,
    runtime,
    security: new SecurityHardeningCenter().getSecurityStatus(),
    workers: new WorkerRuntimeCenter().getRuntimeStatus(),
  });
}

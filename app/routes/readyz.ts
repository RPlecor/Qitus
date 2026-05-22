import { json } from "@remix-run/node";
import { HealthCheckCenter } from "~/modules/deployment/health-check-center.server";

export async function loader() {
  const readiness = await new HealthCheckCenter().getReadiness();
  return json(readiness, { status: readiness.status === "ready" ? 200 : 503 });
}

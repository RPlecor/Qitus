import { json } from "@remix-run/node";
import { HealthCheckCenter } from "~/modules/deployment/health-check-center.server";

export async function loader() {
  return json(new HealthCheckCenter().getLiveness());
}

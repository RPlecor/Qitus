import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { MetricsCenter } from "~/modules/monitoring/monitoring-center.server";

export async function loader(args: LoaderFunctionArgs) {
  await requireCompanyWorkspace(args);
  return json({ metrics: new MetricsCenter().getOperationalMetrics() });
}

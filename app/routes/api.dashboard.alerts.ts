import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { DashboardOverview } from "~/modules/dashboard/dashboard-overview.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const overview = await new DashboardOverview().getOverview(workspace);
  return json({ alerts: overview.alerts });
}

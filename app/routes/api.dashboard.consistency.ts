import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { OperationalDashboardConsistency } from "~/modules/dashboard/operational-dashboard-consistency.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const consistency = await new OperationalDashboardConsistency().getConsistencyReport(workspace);
  return json({ consistency });
}

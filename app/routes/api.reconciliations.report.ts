import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { ReconciliationReportCenter } from "~/modules/reconciliations/reconciliation-report-center.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const report = await new ReconciliationReportCenter().buildFullReport(workspace);
  return json({ report });
}

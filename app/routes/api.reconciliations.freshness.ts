import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { ReconciliationFreshnessCenter } from "~/modules/reconciliations/reconciliation-freshness-center.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const freshness = await new ReconciliationFreshnessCenter().getFreshness(workspace);
  return json({ freshness });
}

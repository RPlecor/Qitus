import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { ReconciliationIssueWorkflow } from "~/modules/reconciliations/reconciliation-issue-workflow.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const readiness = await new ReconciliationIssueWorkflow().summarizeReconciliationReadiness(workspace);
  return json({ readiness });
}

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { ReconciliationReviewWorkflow } from "~/modules/reconciliations/reconciliation-review-workflow.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const issue = await new ReconciliationReviewWorkflow().getIssueDetail(workspace, String(args.params.issueKey));
  return json({ issue });
}

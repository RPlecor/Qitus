import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { ActivityLogCenter } from "~/modules/activity-log/activity-log-center.server";
import { assertFiscalYearMutable } from "~/modules/annual-closing/annual-closing-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { ReconciliationReviewWorkflow } from "~/modules/reconciliations/reconciliation-review-workflow.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  try {
    await assertFiscalYearMutable(workspace);
    const form = await args.request.formData();
    const issue = await new ReconciliationReviewWorkflow().ignoreIssue(workspace, { issueKey: String(args.params.issueKey), note: String(form.get("note") || "") });
    await new ActivityLogCenter().recordActivity(workspace, { action: "reconciliation.issue_ignored", entityType: "reconciliation_issue", entityId: issue.issueKey, metadata: { code: issue.code } });
    if (args.request.headers.get("accept")?.includes("application/json")) return json({ issue });
    return redirect("/rapprochements/revue");
  } catch (error) {
    return jsonOrRedirectError(args.request, error, "/rapprochements/revue");
  }
}

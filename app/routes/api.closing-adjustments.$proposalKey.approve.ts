import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { assertFiscalYearMutable } from "~/modules/annual-closing/annual-closing-center.server";
import { ClosingAdjustmentReviewWorkflow } from "~/modules/closing-adjustments/closing-adjustment-review-workflow.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function action(args: ActionFunctionArgs) {
  const { request, params } = args;
  const workspace = await requireCompanyWorkspace(args);
  try {
    await assertFiscalYearMutable(workspace);
    const proposal = await new ClosingAdjustmentReviewWorkflow().approveWithEvidenceCheck(workspace, { proposalKey: String(params.proposalKey) });
    if (request.headers.get("accept")?.includes("application/json")) return json({ proposal });
    return redirect(`/controle/od/${encodeURIComponent(proposal.proposalKey)}`);
  } catch (error) {
    return jsonOrRedirectError(request, error, `/controle/od/${encodeURIComponent(String(params.proposalKey || ""))}`);
  }
}

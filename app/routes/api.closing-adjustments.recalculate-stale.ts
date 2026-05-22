import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { assertFiscalYearMutable } from "~/modules/annual-closing/annual-closing-center.server";
import { ClosingAdjustmentReviewWorkflow } from "~/modules/closing-adjustments/closing-adjustment-review-workflow.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  try {
    await assertFiscalYearMutable(workspace);
    const proposals = await new ClosingAdjustmentReviewWorkflow().recalculateStale(workspace);
    if (args.request.headers.get("accept")?.includes("application/json")) return json({ proposals });
    return redirect(`/cloture/od?success=${encodeURIComponent(`${proposals.length} OD recalculée(s)`)}`);
  } catch (error) {
    return jsonOrRedirectError(args.request, error, "/cloture/od");
  }
}

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { ClosingAdjustmentReviewWorkflow } from "~/modules/closing-adjustments/closing-adjustment-review-workflow.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const url = new URL(args.request.url);
  const workflow = new ClosingAdjustmentReviewWorkflow();
  const reviews = await workflow.getReviewQueue(workspace, {
    status: url.searchParams.get("status") as never,
    kind: url.searchParams.get("kind"),
    evidence: url.searchParams.get("evidence") as never,
    freshness: url.searchParams.get("freshness") as never,
  });
  const summary = await workflow.summarizeAdjustmentReadiness(workspace);
  return json({ reviews, summary });
}

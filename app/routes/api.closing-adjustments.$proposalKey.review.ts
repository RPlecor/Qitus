import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { ClosingAdjustmentReviewWorkflow } from "~/modules/closing-adjustments/closing-adjustment-review-workflow.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const review = await new ClosingAdjustmentReviewWorkflow().getProposalReview(workspace, String(args.params.proposalKey));
  return json({ review });
}

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { EvidenceReviewWorkflow } from "~/modules/evidence/evidence-review-workflow.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const queue = await new EvidenceReviewWorkflow().getReviewQueue(workspace);
  return json({ queue });
}

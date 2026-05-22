import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { ReconciliationReviewWorkflow } from "~/modules/reconciliations/reconciliation-review-workflow.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const url = new URL(args.request.url);
  const queue = await new ReconciliationReviewWorkflow().getReviewQueue(workspace, {
    kind: url.searchParams.get("kind") as never,
    status: url.searchParams.get("status"),
    severity: url.searchParams.get("severity"),
    source: url.searchParams.get("source"),
  });
  return json({ queue });
}

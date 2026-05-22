import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { ClosingWorkpaperWorkflow } from "~/modules/closing-workpapers/closing-workpaper-workflow.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const url = new URL(args.request.url);
  const workflow = new ClosingWorkpaperWorkflow();
  const reviews = await workflow.getReviewQueue(workspace, {
    kind: url.searchParams.get("kind"),
    status: url.searchParams.get("status") as never,
    missingEvidence: parseBoolean(url.searchParams.get("missingEvidence")),
    hasProposal: parseBoolean(url.searchParams.get("hasProposal")),
  });
  const summary = await workflow.summarizeWorkpaperReadiness(workspace);
  return json({ reviews, summary });
}

function parseBoolean(value: string | null) {
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return null;
}

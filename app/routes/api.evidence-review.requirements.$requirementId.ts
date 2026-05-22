import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { AttachmentMatchingCenter } from "~/modules/evidence/attachment-matching-center.server";
import { EvidenceReviewWorkflow } from "~/modules/evidence/evidence-review-workflow.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const requirementId = String(args.params.requirementId || "");
  const [requirement, attachmentSuggestions] = await Promise.all([
    new EvidenceReviewWorkflow().getRequirement(workspace, requirementId),
    new AttachmentMatchingCenter().suggestAttachmentsForRequirement(workspace, requirementId),
  ]);
  return json({ requirement, attachmentSuggestions });
}

import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { assertFiscalYearMutable } from "~/modules/annual-closing/annual-closing-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { EvidenceReviewWorkflow } from "~/modules/evidence/evidence-review-workflow.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const requirementId = String(args.params.requirementId || "");
  const form = await args.request.formData();
  const returnTo = String(form.get("returnTo") || "/pieces/revue");
  try {
    await assertFiscalYearMutable(workspace);
    const result = await new EvidenceReviewWorkflow().linkAttachmentToRequirement(workspace, {
      requirementId,
      attachmentId: String(form.get("attachmentId") || ""),
      note: String(form.get("note") || "") || null,
    });
    if (args.request.headers.get("accept")?.includes("application/json")) return json(result);
    return redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}success=${encodeURIComponent("Pièce rattachée à l'exigence")}`);
  } catch (error) {
    return jsonOrRedirectError(args.request, error, returnTo);
  }
}

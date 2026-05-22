import { json, type ActionFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { ExpertReviewWorkflow } from "~/modules/expert-dossier/expert-review-workflow.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const form = await args.request.formData();
  try {
    const item = await new ExpertReviewWorkflow().resolveReviewItem(workspace, {
      itemId: String(args.params.id),
      note: String(form.get("note") || "") || null,
    });
    return json({ item });
  } catch (error) {
    return jsonOrRedirectError(args.request, error, "/dossier-ec/revue");
  }
}

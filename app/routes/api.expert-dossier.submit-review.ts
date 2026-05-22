import { json, type ActionFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { ExpertReviewWorkflow } from "~/modules/expert-dossier/expert-review-workflow.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const form = await args.request.formData();
  try {
    const review = await new ExpertReviewWorkflow().startReview(workspace, {
      shareLinkId: String(form.get("shareLinkId") || "") || null,
      reviewerName: String(form.get("reviewerName") || "") || null,
      reviewerEmail: String(form.get("reviewerEmail") || "") || null,
    });
    return json({ review });
  } catch (error) {
    return jsonOrRedirectError(args.request, error, "/dossier-ec");
  }
}

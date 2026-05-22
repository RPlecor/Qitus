import { json, type ActionFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { ExpertReviewWorkflow } from "~/modules/expert-dossier/expert-review-workflow.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const form = await args.request.formData();
  try {
    const comment = await new ExpertReviewWorkflow().addComment({ kind: "workspace", workspace }, {
      itemId: String(args.params.id),
      body: String(form.get("body") || ""),
    });
    return json({ comment });
  } catch (error) {
    return jsonOrRedirectError(args.request, error, "/dossier-ec/revue");
  }
}

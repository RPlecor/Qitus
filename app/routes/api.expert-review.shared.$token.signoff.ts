import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { ExpertReviewWorkflow } from "~/modules/expert-dossier/expert-review-workflow.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function action(args: ActionFunctionArgs) {
  const form = await args.request.formData();
  try {
    const signoff = await new ExpertReviewWorkflow().recordFinalSignoff(String(args.params.token), {
      reviewerName: String(form.get("reviewerName") || ""),
      reviewerEmail: String(form.get("reviewerEmail") || "") || null,
      reviewNote: String(form.get("reviewNote") || "") || null,
    });
    if (args.request.headers.get("accept")?.includes("application/json")) return json({ signoff });
    return redirect(`/shared/${args.params.token}?validated=1`);
  } catch (error) {
    return jsonOrRedirectError(args.request, error, `/shared/${args.params.token}`);
  }
}

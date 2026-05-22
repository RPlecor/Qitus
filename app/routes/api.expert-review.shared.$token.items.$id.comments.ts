import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { ExpertReviewWorkflow } from "~/modules/expert-dossier/expert-review-workflow.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function action(args: ActionFunctionArgs) {
  const form = await args.request.formData();
  try {
    const comment = await new ExpertReviewWorkflow().addComment({ kind: "shared", token: String(args.params.token) }, {
      itemId: String(args.params.id),
      body: String(form.get("body") || ""),
      authorName: String(form.get("authorName") || "") || null,
    });
    if (args.request.headers.get("accept")?.includes("application/json")) return json({ comment });
    return redirect(`/shared/${args.params.token}`);
  } catch (error) {
    return jsonOrRedirectError(args.request, error, `/shared/${args.params.token}`);
  }
}

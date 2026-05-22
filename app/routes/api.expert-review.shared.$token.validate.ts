import { redirect, type ActionFunctionArgs } from "@remix-run/node";
import { ExpertReviewShareCenter } from "~/modules/expert-review/expert-review-share-center.server";

export async function action(args: ActionFunctionArgs) {
  const form = await args.request.formData();
  await new ExpertReviewShareCenter().recordExpertValidation(String(args.params.token), {
    reviewerName: String(form.get("reviewerName") || ""),
    reviewNote: String(form.get("reviewNote") || ""),
  });
  return redirect(`/shared/${args.params.token}?validated=1`);
}

import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { ExpertReviewShareCenter } from "~/modules/expert-review/expert-review-share-center.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const shareLinks = await new ExpertReviewShareCenter().listShareLinks(workspace);
  return json({ shareLinks });
}

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const form = await args.request.formData();
  const shareLink = await new ExpertReviewShareCenter().createShareLink(workspace, {
    label: String(form.get("label") || "Revue expert-comptable"),
    expiresInDays: Number(form.get("expiresInDays") || 30),
  });
  if (args.request.headers.get("accept")?.includes("application/json")) return json({ shareLink });
  return json({ shareLink });
}

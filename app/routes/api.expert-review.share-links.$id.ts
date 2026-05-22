import { json, type ActionFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { ExpertReviewShareCenter } from "~/modules/expert-review/expert-review-share-center.server";

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const revoked = await new ExpertReviewShareCenter().revokeShareLink(workspace, String(args.params.id));
  return json({ shareLink: revoked });
}

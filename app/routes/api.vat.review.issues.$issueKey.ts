import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";
import { VatReviewWorkflow } from "~/modules/vat/vat-review-workflow.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  try {
    const issue = await new VatReviewWorkflow().getIssue(workspace, String(args.params.issueKey || ""));
    return json({ issue });
  } catch (error) {
    return jsonOrRedirectError(args.request, error, "/tva/revue");
  }
}

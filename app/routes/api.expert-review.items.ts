import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { ExpertReviewWorkflow } from "~/modules/expert-dossier/expert-review-workflow.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const url = new URL(args.request.url);
  const items = await new ExpertReviewWorkflow().listReviewItems(workspace, {
    status: (url.searchParams.get("status") || "all") as never,
    sectionCode: url.searchParams.get("sectionCode"),
    severity: url.searchParams.get("severity") as never,
  });
  return json({ items });
}

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const form = await args.request.formData();
  try {
    const item = await new ExpertReviewWorkflow().createReviewItem({ kind: "workspace", workspace }, {
      sectionCode: String(form.get("sectionCode") || "general"),
      severity: String(form.get("severity") || "WARNING") as never,
      title: String(form.get("title") || ""),
      body: String(form.get("body") || ""),
      entityType: String(form.get("entityType") || "") || null,
      entityId: String(form.get("entityId") || "") || null,
    });
    return json({ item });
  } catch (error) {
    return jsonOrRedirectError(args.request, error, "/dossier-ec/revue");
  }
}

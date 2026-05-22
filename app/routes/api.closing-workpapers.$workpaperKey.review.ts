import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { ClosingWorkpaperWorkflow } from "~/modules/closing-workpapers/closing-workpaper-workflow.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const review = await new ClosingWorkpaperWorkflow().getWorkpaperReview(workspace, String(args.params.workpaperKey));
  return json({ review });
}

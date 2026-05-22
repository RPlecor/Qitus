import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { ClosingAdjustmentCenter } from "~/modules/closing-adjustments/closing-adjustment-center.server";
import { ClosingWorkpaperCenter } from "~/modules/closing-workpapers/closing-workpaper-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const [adjustments, workpapers] = await Promise.all([
    new ClosingAdjustmentCenter().summarizeClosingAdjustments(workspace),
    new ClosingWorkpaperCenter().summarizeWorkpapers(workspace),
  ]);
  return json({
    status: workpapers.requiredEvidenceMissing > 0 || adjustments.draft > 0 ? "needs_review" : "ready",
    adjustments,
    workpapers,
  });
}

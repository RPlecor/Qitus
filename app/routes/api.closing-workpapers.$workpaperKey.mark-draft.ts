import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { assertFiscalYearMutable } from "~/modules/annual-closing/annual-closing-center.server";
import { ClosingWorkpaperWorkflow } from "~/modules/closing-workpapers/closing-workpaper-workflow.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const form = await args.request.formData();
  try {
    await assertFiscalYearMutable(workspace);
    const workpaper = await new ClosingWorkpaperWorkflow().markDraft(workspace, String(args.params.workpaperKey), String(form.get("reason") || ""));
    if (args.request.headers.get("accept")?.includes("application/json")) return json({ workpaper });
    return redirect(`/cloture/workpapers/${encodeURIComponent(workpaper.kind)}?success=${encodeURIComponent("Feuille de travail remise en brouillon")}`);
  } catch (error) {
    return jsonOrRedirectError(args.request, error, "/cloture/od");
  }
}

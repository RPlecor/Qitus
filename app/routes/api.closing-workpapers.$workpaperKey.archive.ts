import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { assertFiscalYearMutable } from "~/modules/annual-closing/annual-closing-center.server";
import { ClosingWorkpaperCenter } from "~/modules/closing-workpapers/closing-workpaper-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  try {
    await assertFiscalYearMutable(workspace);
    const workpaper = await new ClosingWorkpaperCenter().archiveWorkpaper(workspace, String(args.params.workpaperKey));
    if (args.request.headers.get("accept")?.includes("application/json")) return json({ workpaper });
    return redirect(`/cloture/workpapers/${encodeURIComponent(workpaper.kind)}`);
  } catch (error) {
    return jsonOrRedirectError(args.request, error, "/cloture/od");
  }
}

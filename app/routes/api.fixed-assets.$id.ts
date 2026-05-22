import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { ActivityLogCenter } from "~/modules/activity-log/activity-log-center.server";
import { assertFiscalYearMutable } from "~/modules/annual-closing/annual-closing-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { FixedAssetRegister } from "~/modules/fixed-assets/fixed-asset-register.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const form = await args.request.formData();
  const center = new FixedAssetRegister();
  try {
    await assertFiscalYearMutable(workspace);
    const asset = form.get("intent") === "archive"
      ? await center.archiveAsset(workspace, String(args.params.id))
      : await center.updateAsset(workspace, String(args.params.id), Object.fromEntries(form.entries()) as never);
    await new ActivityLogCenter().recordActivity(workspace, {
      action: form.get("intent") === "archive" ? "fixed_asset.archived" : "fixed_asset.updated",
      entityType: "fixed_asset",
      entityId: asset.id,
      metadata: { label: asset.label },
    });
    if (args.request.headers.get("accept")?.includes("application/json")) return json({ asset });
    return redirect("/immobilisations");
  } catch (error) {
    return jsonOrRedirectError(args.request, error, "/immobilisations");
  }
}

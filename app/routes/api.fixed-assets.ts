import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { ActivityLogCenter } from "~/modules/activity-log/activity-log-center.server";
import { assertFiscalYearMutable } from "~/modules/annual-closing/annual-closing-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { FixedAssetRegister } from "~/modules/fixed-assets/fixed-asset-register.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const assets = await new FixedAssetRegister().listAssets(workspace);
  return json({ assets });
}

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const form = await args.request.formData();
  try {
    await assertFiscalYearMutable(workspace);
    const asset = await new FixedAssetRegister().createAsset(workspace, Object.fromEntries(form.entries()) as never);
    await new ActivityLogCenter().recordActivity(workspace, {
      action: "fixed_asset.created",
      entityType: "fixed_asset",
      entityId: asset.id,
      metadata: { label: asset.label, amount: asset.amount },
    });
    if (args.request.headers.get("accept")?.includes("application/json")) return json({ asset });
    return redirect("/immobilisations");
  } catch (error) {
    return jsonOrRedirectError(args.request, error, "/immobilisations");
  }
}

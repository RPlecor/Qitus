import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { PrivacyCenter } from "~/modules/privacy/privacy-center.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  try {
    const form = await args.request.formData();
    const request = await new PrivacyCenter().requestSoftDelete(workspace, { reason: String(form.get("reason") || "") });
    if (args.request.headers.get("accept")?.includes("application/json")) return json({ request });
    return redirect("/profil?privacy=soft_deleted");
  } catch (error) {
    return jsonOrRedirectError(args.request, error, "/profil");
  }
}

import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { OpenBankingCenter } from "~/modules/open-banking/open-banking-center.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  try {
    const form = await args.request.formData().catch(() => null);
    const connectionId = typeof form?.get("connectionId") === "string" ? String(form.get("connectionId")) : undefined;
    const result = await new OpenBankingCenter().disconnect(workspace, connectionId);
    if (args.request.headers.get("accept")?.includes("application/json")) return json({ connection: result });
    return redirect("/connecteurs?openBanking=disconnected");
  } catch (error) {
    return jsonOrRedirectError(args.request, error, "/connecteurs");
  }
}

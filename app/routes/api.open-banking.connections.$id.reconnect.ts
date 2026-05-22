import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { OpenBankingSyncWorkflow } from "~/modules/open-banking/open-banking-sync-workflow.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  try {
    const connection = await new OpenBankingSyncWorkflow().reconnect(workspace, args.params.id ?? "");
    if (args.request.headers.get("accept")?.includes("application/json")) return json({ connection });
    return redirect("/connecteurs?openBanking=reconnected");
  } catch (error) {
    return jsonOrRedirectError(args.request, error, "/connecteurs");
  }
}

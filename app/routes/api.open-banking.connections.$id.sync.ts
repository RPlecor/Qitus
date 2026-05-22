import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { RateLimitCenter } from "~/modules/deployment/rate-limit-center.server";
import { OpenBankingSyncWorkflow } from "~/modules/open-banking/open-banking-sync-workflow.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  try {
    new RateLimitCenter().assertAllowed({ key: `open-banking:${workspace.company.id}`, limit: 12, windowMs: 60_000, label: "Synchronisation Open Banking" });
    const result = await new OpenBankingSyncWorkflow().syncConnection(workspace, { connectionId: args.params.id });
    if (args.request.headers.get("accept")?.includes("application/json")) return json(result);
    return redirect("/connecteurs?openBanking=synced");
  } catch (error) {
    return jsonOrRedirectError(args.request, error, "/connecteurs");
  }
}

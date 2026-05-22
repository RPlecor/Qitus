import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { ActivityLogCenter } from "~/modules/activity-log/activity-log-center.server";
import { assertFiscalYearMutable } from "~/modules/annual-closing/annual-closing-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { BankLineReconciliationCenter } from "~/modules/reconciliations/bank-line-reconciliation-center.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  try {
    await assertFiscalYearMutable(workspace);
    const form = await args.request.formData();
    const match = await new BankLineReconciliationCenter().ignoreMatch(workspace, { matchId: String(args.params.id), note: String(form.get("note") || "Ignoré avec note utilisateur") });
    await new ActivityLogCenter().recordActivity(workspace, { action: "reconciliation.bank_match_ignored", entityType: "reconciliation_match", entityId: match.id, metadata: { status: match.status } });
    if (args.request.headers.get("accept")?.includes("application/json")) return json({ match });
    return redirect("/rapprochements/banque");
  } catch (error) {
    return jsonOrRedirectError(args.request, error, "/rapprochements/banque");
  }
}

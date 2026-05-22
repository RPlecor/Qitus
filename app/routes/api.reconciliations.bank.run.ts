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
    const reconciliation = await new BankLineReconciliationCenter().runBankMatching(workspace);
    await new ActivityLogCenter().recordActivity(workspace, { action: "reconciliation.bank_run", entityType: "reconciliation", metadata: { kind: "BANK" } });
    if (args.request.headers.get("accept")?.includes("application/json")) return json({ reconciliation });
    return redirect("/rapprochements/banque");
  } catch (error) {
    return jsonOrRedirectError(args.request, error, "/rapprochements/banque");
  }
}

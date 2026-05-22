import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { ActivityLogCenter } from "~/modules/activity-log/activity-log-center.server";
import { assertFiscalYearMutable } from "~/modules/annual-closing/annual-closing-center.server";
import { BankReconciliationCenter, type BankReconciliationSummary } from "~/modules/reconciliations/bank-reconciliation-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const reconciliation = await new BankReconciliationCenter().getReconciliation(workspace);
  return json({ reconciliation });
}

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const form = await args.request.formData();
  const center = new BankReconciliationCenter();
  try {
    await assertFiscalYearMutable(workspace);
    let reconciliation: BankReconciliationSummary = await center.saveBankStatementBalance(workspace, {
      statementBalance: String(form.get("statementBalance") ?? "0"),
      statementDate: String(form.get("statementDate") || workspace.fiscalYear.endDate.toISOString().slice(0, 10)),
    });
    await new ActivityLogCenter().recordActivity(workspace, {
      action: "bank_reconciliation.saved",
      entityType: "bank_reconciliation",
      entityId: reconciliation.id ?? workspace.bankAccount.id,
      metadata: { status: reconciliation.status, difference: reconciliation.difference },
    });
    if (form.get("confirm") === "on" || form.get("confirm") === "true") {
      reconciliation = await center.confirmReconciliation(workspace);
      await new ActivityLogCenter().recordActivity(workspace, {
        action: "bank_reconciliation.confirmed",
        entityType: "bank_reconciliation",
        entityId: reconciliation.id ?? workspace.bankAccount.id,
        metadata: { status: reconciliation.status, difference: reconciliation.difference },
      });
    }
    if (args.request.headers.get("accept")?.includes("application/json")) return json({ reconciliation });
    return redirect("/cloture/BANK_RECONCILIATION");
  } catch (error) {
    return jsonOrRedirectError(args.request, error, "/cloture/BANK_RECONCILIATION");
  }
}

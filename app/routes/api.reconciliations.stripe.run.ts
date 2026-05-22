import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { ActivityLogCenter } from "~/modules/activity-log/activity-log-center.server";
import { assertFiscalYearMutable } from "~/modules/annual-closing/annual-closing-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { StripeReconciliationCenter } from "~/modules/reconciliations/stripe-reconciliation-center.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  try {
    await assertFiscalYearMutable(workspace);
    const summary = await new StripeReconciliationCenter().runStripeMatching(workspace);
    await new ActivityLogCenter().recordActivity(workspace, { action: "reconciliation.stripe_run", entityType: "reconciliation", metadata: { status: summary.status } });
    if (args.request.headers.get("accept")?.includes("application/json")) return json({ summary });
    return redirect("/rapprochements/stripe");
  } catch (error) {
    return jsonOrRedirectError(args.request, error, "/rapprochements/stripe");
  }
}

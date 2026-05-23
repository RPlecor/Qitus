import { json, type ActionFunctionArgs } from "@remix-run/node";
import { ActivityLogCenter } from "~/modules/activity-log/activity-log-center.server";
import { assertFiscalYearMutable } from "~/modules/annual-closing/annual-closing-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { StripeReconciliationCenter } from "~/modules/reconciliations/stripe-reconciliation-center.server";
import { ExpectedRouteError, jsonOrRedirectError } from "~/modules/route-errors.server";
import { getRuntimeConfig } from "~/modules/runtime-config.server";

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  try {
    const config = getRuntimeConfig();
    if (!config.qitusInternalTestMode) throw new ExpectedRouteError("Banc de test interne désactivé.", 403);
    await assertFiscalYearMutable(workspace);
    const imported = await new StripeReconciliationCenter().importStripeFixture(workspace);
    await new ActivityLogCenter().recordActivity(workspace, { action: "internal_test.stripe_imported", entityType: "connector", entityId: "stripe", metadata: { testMode: true, ...imported } });
    return json({ imported, testMode: true });
  } catch (error) {
    return jsonOrRedirectError(args.request, error, "/connecteurs");
  }
}

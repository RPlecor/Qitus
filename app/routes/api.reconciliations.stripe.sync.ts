import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { ActivityLogCenter } from "~/modules/activity-log/activity-log-center.server";
import { assertFiscalYearMutable } from "~/modules/annual-closing/annual-closing-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { ConnectorSyncCenter } from "~/modules/reconciliations/connector-sync-center.server";
import { ExpectedRouteError, jsonOrRedirectError } from "~/modules/route-errors.server";
import { getRuntimeConfig } from "~/modules/runtime-config.server";

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  try {
    const config = getRuntimeConfig();
    if (!config.qitusInternalTestMode && config.connectorsMode === "fixture") throw new ExpectedRouteError("Banc de test interne désactivé.", 403);
    await assertFiscalYearMutable(workspace);
    const sync = await new ConnectorSyncCenter(config).syncStripe(workspace);
    await new ActivityLogCenter().recordActivity(workspace, { action: "reconciliation.stripe_synced", entityType: "reconciliation", metadata: sync });
    if (args.request.headers.get("accept")?.includes("application/json")) return json({ sync });
    return redirect("/rapprochements/stripe");
  } catch (error) {
    return jsonOrRedirectError(args.request, error, "/rapprochements/stripe");
  }
}

import { json, type ActionFunctionArgs } from "@remix-run/node";
import { assertFiscalYearMutable } from "~/modules/annual-closing/annual-closing-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { RateLimitCenter } from "~/modules/deployment/rate-limit-center.server";
import { ConnectorSyncCenter } from "~/modules/reconciliations/connector-sync-center.server";
import { ExpectedRouteError, jsonOrRedirectError } from "~/modules/route-errors.server";
import { getRuntimeConfig } from "~/modules/runtime-config.server";

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  try {
    const config = getRuntimeConfig();
    if (!config.qitusInternalTestMode && config.connectorsMode === "fixture") throw new ExpectedRouteError("Banc de test interne désactivé.", 403);
    await assertFiscalYearMutable(workspace);
    new RateLimitCenter().assertAllowed({ key: `stripe-sync:${workspace.company.id}`, limit: 12, windowMs: 60_000, label: "Synchronisation Stripe" });
    return json({ sync: await new ConnectorSyncCenter(config).syncStripe(workspace) });
  } catch (error) {
    return jsonOrRedirectError(args.request, error, "/rapprochements/stripe");
  }
}

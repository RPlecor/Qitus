import { json, type ActionFunctionArgs } from "@remix-run/node";
import { assertFiscalYearMutable } from "~/modules/annual-closing/annual-closing-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { RateLimitCenter } from "~/modules/deployment/rate-limit-center.server";
import { ConnectorSyncCenter } from "~/modules/reconciliations/connector-sync-center.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  try {
    await assertFiscalYearMutable(workspace);
    new RateLimitCenter().assertAllowed({ key: `qonto-sync:${workspace.company.id}`, limit: 12, windowMs: 60_000, label: "Synchronisation Qonto" });
    return json({ sync: await new ConnectorSyncCenter().syncQonto(workspace) });
  } catch (error) {
    return jsonOrRedirectError(args.request, error, "/rapprochements/banque");
  }
}

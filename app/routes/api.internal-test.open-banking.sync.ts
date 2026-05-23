import { json, type ActionFunctionArgs } from "@remix-run/node";
import { ActivityLogCenter } from "~/modules/activity-log/activity-log-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { OpenBankingCenter } from "~/modules/open-banking/open-banking-center.server";
import { ExpectedRouteError, jsonOrRedirectError } from "~/modules/route-errors.server";
import { getRuntimeConfig } from "~/modules/runtime-config.server";

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  try {
    const config = getRuntimeConfig();
    if (!config.qitusInternalTestMode) throw new ExpectedRouteError("Banc de test interne désactivé.", 403);
    const center = new OpenBankingCenter({ ...config, openBankingProvider: "mock" });
    await center.createConsent(workspace);
    await center.completeMockConsent(workspace);
    const sync = await center.sync(workspace);
    await new ActivityLogCenter().recordActivity(workspace, { action: "internal_test.open_banking_synced", entityType: "connector", entityId: "open_banking", metadata: { testMode: true, fetched: sync.transactionsFetched, imported: sync.transactionsImported } });
    return json({ sync, testMode: true });
  } catch (error) {
    return jsonOrRedirectError(args.request, error, "/connecteurs");
  }
}

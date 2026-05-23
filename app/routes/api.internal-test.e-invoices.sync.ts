import { json, type ActionFunctionArgs } from "@remix-run/node";
import { ActivityLogCenter } from "~/modules/activity-log/activity-log-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { MockEInvoiceProviderAdapter } from "~/modules/e-invoices/e-invoice-provider-adapter.server";
import { EInvoiceSyncWorkflow } from "~/modules/e-invoices/e-invoice-sync-workflow.server";
import { ExpectedRouteError, jsonOrRedirectError } from "~/modules/route-errors.server";
import { getRuntimeConfig } from "~/modules/runtime-config.server";

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  try {
    const config = getRuntimeConfig();
    if (!config.qitusInternalTestMode) throw new ExpectedRouteError("Banc de test interne désactivé.", 403);
    const sync = await new EInvoiceSyncWorkflow(new MockEInvoiceProviderAdapter()).syncIncomingInvoices(workspace);
    await new ActivityLogCenter().recordActivity(workspace, { action: "internal_test.e_invoice_synced", entityType: "connector", entityId: "e_invoice", metadata: { testMode: true, fetched: sync.fetchedCount, imported: sync.importedCount } });
    return json({ sync, testMode: true });
  } catch (error) {
    return jsonOrRedirectError(args.request, error, "/connecteurs");
  }
}

import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { EInvoiceSyncWorkflow } from "~/modules/e-invoices/e-invoice-sync-workflow.server";
import { ExpectedRouteError, jsonOrRedirectError } from "~/modules/route-errors.server";
import { getRuntimeConfig } from "~/modules/runtime-config.server";

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  try {
    const config = getRuntimeConfig();
    if (!config.qitusInternalTestMode && ["mock", "sandbox", "generic_pa"].includes(config.eInvoiceProvider)) {
      throw new ExpectedRouteError("Connecteur de test interne désactivé sur cette instance.", 403);
    }
    const sync = await new EInvoiceSyncWorkflow().syncIncomingInvoices(workspace);
    if (args.request.headers.get("accept")?.includes("application/json")) return json({ sync });
    const message = sync.status === "COMPLETED" ? `${sync.importedCount} facture(s) synchronisée(s)` : sync.errorMessage ?? "Synchronisation échouée";
    return redirect(`/factures-entrantes?${sync.status === "COMPLETED" ? "success" : "error"}=${encodeURIComponent(message)}`);
  } catch (error) {
    return jsonOrRedirectError(args.request, error, "/factures-entrantes");
  }
}

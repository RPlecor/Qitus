import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { EInvoiceSyncWorkflow } from "~/modules/e-invoices/e-invoice-sync-workflow.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  try {
    const sync = await new EInvoiceSyncWorkflow().syncIncomingInvoices(workspace);
    if (args.request.headers.get("accept")?.includes("application/json")) return json({ sync });
    const message = sync.status === "COMPLETED" ? `${sync.importedCount} facture(s) synchronisée(s)` : sync.errorMessage ?? "Synchronisation échouée";
    return redirect(`/factures-entrantes?${sync.status === "COMPLETED" ? "success" : "error"}=${encodeURIComponent(message)}`);
  } catch (error) {
    return jsonOrRedirectError(args.request, error, "/factures-entrantes");
  }
}

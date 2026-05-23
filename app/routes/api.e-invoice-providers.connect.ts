import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { EInvoiceProviderCenter } from "~/modules/e-invoices/e-invoice-provider-center.server";
import { ExpectedRouteError, jsonOrRedirectError } from "~/modules/route-errors.server";
import { getRuntimeConfig } from "~/modules/runtime-config.server";

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  try {
    const config = getRuntimeConfig();
    if (!config.qitusInternalTestMode && ["mock", "sandbox", "generic_pa"].includes(config.eInvoiceProvider)) {
      throw new ExpectedRouteError("Connecteur de test interne désactivé sur cette instance.", 403);
    }
    const result = await new EInvoiceProviderCenter().createConnection(workspace);
    if (args.request.headers.get("accept")?.includes("application/json")) return json(result);
    return redirect(`/factures-entrantes?success=${encodeURIComponent("Provider facture électronique connecté")}`);
  } catch (error) {
    return jsonOrRedirectError(args.request, error, "/factures-entrantes");
  }
}

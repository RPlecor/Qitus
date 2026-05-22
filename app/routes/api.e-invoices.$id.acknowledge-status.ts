import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { EInvoiceProviderCenter } from "~/modules/e-invoices/e-invoice-provider-center.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

const STATUSES = new Set(["READ", "MATCHED", "ACCOUNTED", "REJECTED"]);

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const target = `/factures-entrantes/${args.params.id}`;
  try {
    const form = await args.request.formData();
    const status = form.get("status")?.toString() ?? "READ";
    if (!STATUSES.has(status)) throw new Error("Statut PA non supporté.");
    const result = await new EInvoiceProviderCenter().acknowledgeInvoiceStatus(workspace, String(args.params.id), status as never);
    if (args.request.headers.get("accept")?.includes("application/json")) return json(result);
    return redirect(`${target}?success=${encodeURIComponent("Statut PA mis à jour")}`);
  } catch (error) {
    return jsonOrRedirectError(args.request, error, target);
  }
}

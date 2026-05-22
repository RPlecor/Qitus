import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { assertFiscalYearMutable } from "~/modules/annual-closing/annual-closing-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { EInvoiceCenter } from "~/modules/e-invoices/e-invoice-center.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const target = `/factures-entrantes/${args.params.id}`;
  try {
    await assertFiscalYearMutable(workspace);
    const invoice = await new EInvoiceCenter().reparseEInvoice(workspace, String(args.params.id));
    if (args.request.headers.get("accept")?.includes("application/json")) return json({ invoice });
    return redirect(`${target}?success=${encodeURIComponent("Facture reparsée")}`);
  } catch (error) {
    return jsonOrRedirectError(args.request, error, target);
  }
}

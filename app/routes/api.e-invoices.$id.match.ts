import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { assertFiscalYearMutable } from "~/modules/annual-closing/annual-closing-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { EInvoiceMatchingCenter } from "~/modules/e-invoices/e-invoice-matching-center.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const target = `/factures-entrantes/${args.params.id}`;
  const form = await args.request.formData();
  try {
    await assertFiscalYearMutable(workspace);
    const result = await new EInvoiceMatchingCenter().markMatched(workspace, {
      eInvoiceId: String(args.params.id),
      entityType: String(form.get("entityType")) as "TRANSACTION" | "JOURNAL_ENTRY",
      entityId: String(form.get("entityId")),
      note: String(form.get("note") || "") || null,
    });
    if (args.request.headers.get("accept")?.includes("application/json")) return json(result);
    return redirect(`${target}?success=${encodeURIComponent("Facture rapprochée")}`);
  } catch (error) {
    return jsonOrRedirectError(args.request, error, target);
  }
}

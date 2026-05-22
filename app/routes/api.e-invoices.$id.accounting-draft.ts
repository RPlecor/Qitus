import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { assertFiscalYearMutable } from "~/modules/annual-closing/annual-closing-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { EInvoiceAccountingDraftCenter } from "~/modules/e-invoices/e-invoice-accounting-draft-center.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const target = `/factures-entrantes/${args.params.id}`;
  try {
    await assertFiscalYearMutable(workspace);
    const draft = await new EInvoiceAccountingDraftCenter().createDraft(workspace, String(args.params.id));
    if (args.request.headers.get("accept")?.includes("application/json")) return json({ draft });
    return redirect(`${target}?success=${encodeURIComponent("Brouillon comptable créé")}`);
  } catch (error) {
    return jsonOrRedirectError(args.request, error, target);
  }
}

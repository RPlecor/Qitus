import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { EInvoiceAccountingDraftCenter } from "~/modules/e-invoices/e-invoice-accounting-draft-center.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const target = `/factures-entrantes/${args.params.id}`;
  const form = await args.request.formData();
  try {
    const draft = await new EInvoiceAccountingDraftCenter().rejectDraft(workspace, {
      draftId: String(form.get("draftId")),
      note: String(form.get("note") || ""),
    });
    if (args.request.headers.get("accept")?.includes("application/json")) return json({ draft });
    return redirect(`${target}?success=${encodeURIComponent("Brouillon rejeté")}`);
  } catch (error) {
    return jsonOrRedirectError(args.request, error, target);
  }
}

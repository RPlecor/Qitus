import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { assertFiscalYearMutable } from "~/modules/annual-closing/annual-closing-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { AttachmentExtractionCenter } from "~/modules/evidence/attachment-extraction-center.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const form = await args.request.formData();
  const returnTo = String(form.get("returnTo") || `/pieces/${args.params.id}`);
  try {
    await assertFiscalYearMutable(workspace);
    const extraction = await new AttachmentExtractionCenter().saveManualExtraction(workspace, {
      attachmentId: String(args.params.id),
      supplierName: stringValue(form.get("supplierName")),
      invoiceDate: stringValue(form.get("invoiceDate")),
      invoiceNumber: stringValue(form.get("invoiceNumber")),
      amountHt: stringValue(form.get("amountHt")),
      amountVat: stringValue(form.get("amountVat")),
      amountTtc: stringValue(form.get("amountTtc")),
      currency: stringValue(form.get("currency")),
      extractedText: stringValue(form.get("extractedText")),
    });
    if (args.request.headers.get("accept")?.includes("application/json")) return json({ extraction });
    return redirect(`${returnTo}?success=${encodeURIComponent("Informations de pièce enregistrées")}`);
  } catch (error) {
    return jsonOrRedirectError(args.request, error, returnTo);
  }
}

function stringValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : null;
}

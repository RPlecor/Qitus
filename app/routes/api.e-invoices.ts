import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { assertFiscalYearMutable } from "~/modules/annual-closing/annual-closing-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { EInvoiceCenter } from "~/modules/e-invoices/e-invoice-center.server";
import { AttachmentCenter } from "~/modules/evidence/attachment-center.server";
import { prisma } from "~/modules/db.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const url = new URL(args.request.url);
  const invoices = await new EInvoiceCenter().listEInvoices(workspace, { status: url.searchParams.get("status") });
  return json({ invoices });
}

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const form = await args.request.formData();
  const file = form.get("file");
  try {
    await assertFiscalYearMutable(workspace);
    if (!(file instanceof File)) return json({ error: "Fichier facture manquant." }, { status: 400 });
    const attachment = await new AttachmentCenter().uploadAttachment(workspace, {
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      bytes: Buffer.from(await file.arrayBuffer()),
    });
    const invoice = await prisma.eInvoice.findFirst({
      where: { attachmentId: attachment.id, companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id },
      orderBy: { createdAt: "desc" },
    });
    if (!invoice) return json({ error: "Facture électronique structurée non détectée." }, { status: 422 });
    if (args.request.headers.get("accept")?.includes("application/json")) return json({ invoice });
    return redirect(`/factures-entrantes/${invoice.id}?success=${encodeURIComponent("Facture électronique ajoutée")}`);
  } catch (error) {
    return jsonOrRedirectError(args.request, error, "/factures-entrantes");
  }
}

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { EInvoiceAuditTrailCenter } from "~/modules/e-invoices/e-invoice-audit-trail-center.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  return json(await new EInvoiceAuditTrailCenter().getProviderAudit(workspace));
}

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { EInvoiceCenter } from "~/modules/e-invoices/e-invoice-center.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const invoice = await new EInvoiceCenter().getEInvoiceDetail(workspace, String(args.params.id));
  return json({ invoice });
}

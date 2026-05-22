import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { EInvoiceProviderCenter } from "~/modules/e-invoices/e-invoice-provider-center.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  try {
    const form = await args.request.formData().catch(() => null);
    const connectionId = form?.get("connectionId")?.toString() ?? null;
    const result = await new EInvoiceProviderCenter().disconnect(workspace, connectionId);
    if (args.request.headers.get("accept")?.includes("application/json")) return json({ connection: result });
    return redirect(`/connecteurs?eInvoiceProvider=${encodeURIComponent("disconnected")}`);
  } catch (error) {
    return jsonOrRedirectError(args.request, error, "/connecteurs");
  }
}

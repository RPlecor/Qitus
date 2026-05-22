import { json, type ActionFunctionArgs } from "@remix-run/node";
import { createEInvoiceProviderAdapter } from "~/modules/e-invoices/e-invoice-provider-adapter.server";

export async function action(args: ActionFunctionArgs) {
  const rawBody = await args.request.text();
  const accepted = await createEInvoiceProviderAdapter().verifyWebhook(args.request, rawBody);
  return json({ accepted });
}

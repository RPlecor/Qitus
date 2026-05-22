import { json, type ActionFunctionArgs } from "@remix-run/node";
import { EInvoiceProviderWebhookReceiver } from "~/modules/e-invoices/e-invoice-provider-webhook-receiver.server";
import { ExpectedRouteError, routeErrorMessage } from "~/modules/route-errors.server";

export async function action(args: ActionFunctionArgs) {
  try {
    return json(await new EInvoiceProviderWebhookReceiver().verifyAndHandleWebhook(args.request));
  } catch (error) {
    return json({ ok: false, error: routeErrorMessage(error) }, { status: error instanceof ExpectedRouteError ? error.status : 500 });
  }
}

import { json, type ActionFunctionArgs } from "@remix-run/node";
import { OpenBankingWebhookReceiver } from "~/modules/open-banking/open-banking-webhook-receiver.server";
import { ExpectedRouteError, routeErrorMessage } from "~/modules/route-errors.server";

export async function action(args: ActionFunctionArgs) {
  try {
    return json(await new OpenBankingWebhookReceiver().verifyAndHandleWebhook(args.request));
  } catch (error) {
    return json({ ok: false, error: routeErrorMessage(error) }, { status: error instanceof ExpectedRouteError ? error.status : 500 });
  }
}

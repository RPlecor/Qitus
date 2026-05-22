import { json, type ActionFunctionArgs } from "@remix-run/node";
import { ClerkWebhookReceiver } from "~/modules/clerk-webhook/clerk-webhook-receiver.server";
import { routeErrorMessage } from "~/modules/route-errors.server";

export async function action({ request }: ActionFunctionArgs) {
  try {
    const receiver = new ClerkWebhookReceiver();
    const event = await receiver.verifyAndParse(request);
    if (event.type !== "user.created" && event.type !== "user.updated" && event.type !== "user.deleted") return json({ ignored: true });
    return json(await receiver.handleEvent(event));
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" ? error.status : 500;
    return json({ error: routeErrorMessage(error) }, { status });
  }
}

import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { BillingCheckoutCenter } from "~/modules/billing/billing-checkout-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function action(args: ActionFunctionArgs) {
  const { request } = args;
  const workspace = await requireCompanyWorkspace(args);
  try {
    const session = await new BillingCheckoutCenter().createCustomerPortalSession(workspace, {
      origin: new URL(request.url).origin,
    });
    if (request.headers.get("accept")?.includes("application/json")) return json(session);
    return redirect(session.url);
  } catch (error) {
    return jsonOrRedirectError(request, error, "/abonnement");
  }
}

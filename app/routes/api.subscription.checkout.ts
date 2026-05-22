import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import type { SubscriptionTier } from "@prisma/client";
import { BillingCheckoutCenter } from "~/modules/billing/billing-checkout-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function action(args: ActionFunctionArgs) {
  const { request } = args;
  const workspace = await requireCompanyWorkspace(args);
  try {
    const form = await request.formData();
    const tier = normalizeTier(form.get("tier"));
    const session = await new BillingCheckoutCenter().createCheckoutSession(workspace, {
      tier,
      origin: new URL(request.url).origin,
    });
    if (request.headers.get("accept")?.includes("application/json")) return json(session);
    return redirect(session.url);
  } catch (error) {
    return jsonOrRedirectError(request, error, "/abonnement");
  }
}

function normalizeTier(value: FormDataEntryValue | null): SubscriptionTier {
  if (value === "ENTREPRISE" || value === "ENTREPRISE_PLUS") return value;
  return "SOLO";
}

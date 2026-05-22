import { createHmac, timingSafeEqual } from "node:crypto";
import { ExpectedRouteError } from "../route-errors.server";
import { getRuntimeConfig, type RuntimeConfig } from "../runtime-config.server";

export type StripeCheckoutInput = {
  customerEmail: string;
  companyId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
};

export type StripePortalInput = {
  customerId: string;
  returnUrl: string;
};

export type StripeEvent = {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
};

export class StripeBillingAdapter {
  constructor(private readonly config: RuntimeConfig = getRuntimeConfig()) {}

  async createCheckoutSession(input: StripeCheckoutInput) {
    this.assertStripeConfigured();
    const response = await stripePost(this.config.stripeSecretKey!, "/v1/checkout/sessions", {
      mode: "subscription",
      customer_email: input.customerEmail,
      "line_items[0][price]": input.priceId,
      "line_items[0][quantity]": "1",
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      "metadata[companyId]": input.companyId,
      "subscription_data[metadata][companyId]": input.companyId,
    });
    return { id: String(response.id), url: String(response.url) };
  }

  async createCustomerPortalSession(input: StripePortalInput) {
    this.assertStripeConfigured();
    const response = await stripePost(this.config.stripeSecretKey!, "/v1/billing_portal/sessions", {
      customer: input.customerId,
      return_url: input.returnUrl,
    });
    return { id: String(response.id), url: String(response.url) };
  }

  verifyWebhook(rawBody: string, signatureHeader: string | null): StripeEvent {
    if (!this.config.stripeWebhookSecret) throw new ExpectedRouteError("STRIPE_WEBHOOK_SECRET manquant.", 500);
    if (!signatureHeader) throw new ExpectedRouteError("Signature Stripe manquante.", 401);
    const timestamp = signaturePart(signatureHeader, "t");
    const expectedSignatures = signatureHeader.split(",").filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
    if (!timestamp || expectedSignatures.length === 0) throw new ExpectedRouteError("Signature Stripe invalide.", 401);
    const signedPayload = `${timestamp}.${rawBody}`;
    const digest = createHmac("sha256", this.config.stripeWebhookSecret).update(signedPayload).digest("hex");
    const verified = expectedSignatures.some((signature) => safeEqual(signature, digest));
    if (!verified) throw new ExpectedRouteError("Signature Stripe refusée.", 401);
    return JSON.parse(rawBody) as StripeEvent;
  }

  private assertStripeConfigured() {
    if (this.config.billingMode !== "stripe") throw new ExpectedRouteError("Billing Stripe désactivé en mode local.", 409);
    if (!this.config.stripeSecretKey) throw new ExpectedRouteError("STRIPE_SECRET_KEY manquant.", 500);
  }
}

async function stripePost(secretKey: string, path: string, body: Record<string, string>) {
  const response = await fetch(`https://api.stripe.com${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body),
  });
  const payload = await response.json() as Record<string, unknown>;
  if (!response.ok) {
    const error = payload.error as { message?: string } | undefined;
    throw new ExpectedRouteError(error?.message ?? "Stripe a refusé la requête.", response.status);
  }
  return payload;
}

function signaturePart(header: string, key: string) {
  return header.split(",").find((part) => part.startsWith(`${key}=`))?.slice(key.length + 1) ?? null;
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

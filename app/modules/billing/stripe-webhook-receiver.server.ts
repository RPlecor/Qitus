import type { SubscriptionTier } from "@prisma/client";
import { ActivityLogCenter } from "../activity-log/activity-log-center.server";
import { prisma } from "../db.server";
import { ExpectedRouteError } from "../route-errors.server";
import { StripeBillingAdapter, type StripeEvent } from "./stripe-billing-adapter.server";
import { SubscriptionCenter } from "./subscription-center.server";

export class StripeWebhookReceiver {
  constructor(
    private readonly stripe = new StripeBillingAdapter(),
    private readonly subscriptions = new SubscriptionCenter(),
    private readonly activity = new ActivityLogCenter()
  ) {}

  async verifyAndHandleStripeWebhook(request: Request) {
    const rawBody = await request.text();
    const event = this.stripe.verifyWebhook(rawBody, request.headers.get("stripe-signature"));
    return this.handleEvent(event);
  }

  async handleEvent(event: StripeEvent) {
    const existing = await prisma.billingWebhookEvent.findUnique({ where: { eventId: event.id } });
    if (existing?.status === "processed") return { duplicate: true, eventId: event.id };
    await prisma.billingWebhookEvent.upsert({
      where: { eventId: event.id },
      create: { provider: "stripe", eventId: event.id, eventType: event.type, status: "processing" },
      update: { status: "processing", errorMessage: null },
    });

    try {
      const result = await this.dispatch(event);
      await prisma.billingWebhookEvent.update({
        where: { eventId: event.id },
        data: { status: "processed", processedAt: new Date() },
      });
      return { duplicate: false, eventId: event.id, result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await prisma.billingWebhookEvent.update({
        where: { eventId: event.id },
        data: { status: "failed", errorMessage: message },
      });
      await recordWebhookFailure(event, message);
      throw error;
    }
  }

  private async dispatch(event: StripeEvent) {
    if (event.type === "checkout.session.completed") return this.handleCheckoutSession(event);
    if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      return this.handleSubscriptionEvent(event);
    }
    return { ignored: true };
  }

  private async handleCheckoutSession(event: StripeEvent) {
    const object = event.data.object;
    const companyId = stringValue((object.metadata as Record<string, unknown> | undefined)?.companyId);
    const stripeCustomerId = stringValue(object.customer);
    const stripeSubscriptionId = stringValue(object.subscription);
    if (!companyId || !stripeCustomerId) throw new ExpectedRouteError("Webhook Stripe incomplet : companyId/customer manquant.", 400);
    const subscription = await this.subscriptions.syncStripeSubscription({
      companyId,
      stripeCustomerId,
      stripeSubscriptionId,
      status: "active",
      tier: this.tierFromStripeObject(object),
    });
    await recordSubscriptionUpdated(companyId, event.type, subscription.id);
    return { subscriptionId: subscription.id };
  }

  private async handleSubscriptionEvent(event: StripeEvent) {
    const object = event.data.object;
    const metadata = object.metadata as Record<string, unknown> | undefined;
    const stripeCustomerId = stringValue(object.customer);
    if (!stripeCustomerId) throw new ExpectedRouteError("Webhook Stripe incomplet : customer manquant.", 400);
    const subscription = await this.subscriptions.syncStripeSubscription({
      companyId: stringValue(metadata?.companyId),
      stripeCustomerId,
      stripeSubscriptionId: stringValue(object.id),
      status: stringValue(object.status) ?? "incomplete",
      tier: this.tierFromStripeObject(object),
      currentPeriodStart: unixDate(object.current_period_start),
      currentPeriodEnd: unixDate(object.current_period_end),
      cancelAtPeriodEnd: Boolean(object.cancel_at_period_end),
    });
    await recordSubscriptionUpdated(subscription.companyId, event.type, subscription.id);
    return { subscriptionId: subscription.id };
  }

  private tierFromStripeObject(object: Record<string, unknown>): SubscriptionTier | undefined {
    return tierFromMetadata(object.metadata) ?? this.subscriptions.tierForStripePrice(firstPriceId(object));
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function unixDate(value: unknown) {
  return typeof value === "number" ? new Date(value * 1000) : null;
}

function tierFromMetadata(metadata: unknown): SubscriptionTier | undefined {
  if (!metadata || typeof metadata !== "object") return undefined;
  const value = (metadata as Record<string, unknown>).tier;
  if (value === "SOLO" || value === "ENTREPRISE" || value === "ENTREPRISE_PLUS") return value;
  return undefined;
}

function firstPriceId(object: Record<string, unknown>) {
  const items = object.items as { data?: Array<{ price?: { id?: string } }> } | undefined;
  return items?.data?.[0]?.price?.id ?? null;
}

async function recordSubscriptionUpdated(companyId: string, type: string, subscriptionId: string) {
  const workspace = await workspaceForCompany(companyId);
  if (!workspace) return;
  await new ActivityLogCenter().recordActivity(workspace, {
    action: "billing.subscription_updated",
    entityType: "billing",
    entityId: subscriptionId,
    metadata: { type },
  });
}

async function recordWebhookFailure(event: StripeEvent, message: string) {
  const companyId = stringValue((event.data.object.metadata as Record<string, unknown> | undefined)?.companyId);
  if (!companyId) return;
  const workspace = await workspaceForCompany(companyId);
  if (!workspace) return;
  await new ActivityLogCenter().recordActivity(workspace, {
    action: "billing.webhook_failed",
    entityType: "billing",
    entityId: event.id,
    metadata: { type: event.type, message },
  });
}

async function workspaceForCompany(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { user: true, fiscalYears: true, bankAccounts: true },
  });
  if (!company || company.fiscalYears.length === 0 || company.bankAccounts.length === 0) return null;
  const { user, ...companyWithoutUser } = company;
  return {
    user,
    company: companyWithoutUser,
    fiscalYear: company.fiscalYears[0],
    bankAccount: company.bankAccounts[0],
    subscription: await new SubscriptionCenter().getSubscription({ company: companyWithoutUser }),
    authMode: "dev" as const,
  };
}

import type { BillingProvider, Subscription, SubscriptionStatus, SubscriptionTier } from "@prisma/client";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { getRuntimeConfig, type RuntimeConfig } from "../runtime-config.server";

export type TierLimits = {
  requestsPerMinute: number;
  aiCallsPerMonth: number;
  importsPerMonth: number;
};

export type SubscriptionState = {
  id: string | null;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  provider: BillingProvider;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  limits: TierLimits;
};

export class SubscriptionCenter {
  constructor(private readonly config: RuntimeConfig = getRuntimeConfig()) {}

  async getSubscription(workspace: Pick<CompanyWorkspace, "company">): Promise<SubscriptionState> {
    const subscription = await this.getOrCreateSubscription(workspace.company.id);
    return toState(subscription);
  }

  async syncStripeSubscription(input: {
    companyId?: string | null;
    stripeCustomerId: string;
    stripeSubscriptionId?: string | null;
    status: string;
    tier?: SubscriptionTier;
    currentPeriodStart?: Date | null;
    currentPeriodEnd?: Date | null;
    cancelAtPeriodEnd?: boolean;
  }): Promise<Subscription> {
    const companyId = input.companyId ?? await this.findCompanyIdForStripeCustomer(input.stripeCustomerId);
    if (!companyId) throw new Error(`Aucune company ne correspond au client Stripe ${input.stripeCustomerId}.`);
    return prisma.subscription.upsert({
      where: { companyId },
      create: {
        companyId,
        tier: input.tier ?? "SOLO",
        status: stripeStatus(input.status),
        provider: "STRIPE",
        stripeCustomerId: input.stripeCustomerId,
        stripeSubscriptionId: input.stripeSubscriptionId,
        currentPeriodStart: input.currentPeriodStart,
        currentPeriodEnd: input.currentPeriodEnd,
        cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
      },
      update: {
        tier: input.tier ?? undefined,
        status: stripeStatus(input.status),
        provider: "STRIPE",
        stripeCustomerId: input.stripeCustomerId,
        stripeSubscriptionId: input.stripeSubscriptionId,
        currentPeriodStart: input.currentPeriodStart,
        currentPeriodEnd: input.currentPeriodEnd,
        cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
      },
    });
  }

  tierForStripePrice(priceId: string | null | undefined): SubscriptionTier | undefined {
    if (!priceId) return undefined;
    if (priceId === this.config.stripePriceSolo) return "SOLO";
    if (priceId === this.config.stripePriceEntreprise) return "ENTREPRISE";
    if (priceId === this.config.stripePriceEntreprisePlus) return "ENTREPRISE_PLUS";
    return undefined;
  }

  private async getOrCreateSubscription(companyId: string): Promise<Subscription> {
    const existing = await prisma.subscription.findUnique({ where: { companyId } });
    if (existing) return existing;
    return prisma.subscription.create({
      data: {
        companyId,
        tier: "SOLO",
        status: this.config.billingMode === "stripe" ? "INCOMPLETE" : "ACTIVE_STUB",
        provider: this.config.billingMode === "stripe" ? "STRIPE" : "NONE",
      },
    });
  }

  private async findCompanyIdForStripeCustomer(stripeCustomerId: string) {
    const subscription = await prisma.subscription.findFirst({ where: { stripeCustomerId }, select: { companyId: true } });
    return subscription?.companyId ?? null;
  }
}

export function tierLimits(tier: SubscriptionTier): TierLimits {
  if (tier === "ENTREPRISE_PLUS") return { requestsPerMinute: 200, aiCallsPerMonth: 1000, importsPerMonth: 50 };
  if (tier === "ENTREPRISE") return { requestsPerMinute: 120, aiCallsPerMonth: 300, importsPerMonth: 15 };
  return { requestsPerMinute: 60, aiCallsPerMonth: 100, importsPerMonth: 5 };
}

export function toState(subscription: Subscription): SubscriptionState {
  return {
    id: subscription.id,
    tier: subscription.tier,
    status: subscription.status,
    provider: subscription.provider,
    stripeCustomerId: subscription.stripeCustomerId,
    stripeSubscriptionId: subscription.stripeSubscriptionId,
    currentPeriodStart: subscription.currentPeriodStart?.toISOString() ?? null,
    currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    limits: tierLimits(subscription.tier),
  };
}

function stripeStatus(status: string): SubscriptionStatus {
  if (status === "trialing") return "TRIALING";
  if (status === "active") return "ACTIVE";
  if (status === "past_due") return "PAST_DUE";
  if (status === "canceled" || status === "cancelled") return "CANCELED";
  return "INCOMPLETE";
}

export type { BillingProvider, SubscriptionStatus, SubscriptionTier };

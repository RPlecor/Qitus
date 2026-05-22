import type { SubscriptionTier } from "@prisma/client";
import { ActivityLogCenter } from "../activity-log/activity-log-center.server";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { ExpectedRouteError } from "../route-errors.server";
import { getRuntimeConfig, type RuntimeConfig } from "../runtime-config.server";
import { StripeBillingAdapter } from "./stripe-billing-adapter.server";
import { SubscriptionCenter } from "./subscription-center.server";

export class BillingCheckoutCenter {
  constructor(
    private readonly config: RuntimeConfig = getRuntimeConfig(),
    private readonly stripe = new StripeBillingAdapter(config),
    private readonly subscriptions = new SubscriptionCenter(config),
    private readonly activity = new ActivityLogCenter()
  ) {}

  async createCheckoutSession(workspace: CompanyWorkspace, input: { tier: SubscriptionTier; origin: string }) {
    if (this.config.billingMode !== "stripe") {
      throw new ExpectedRouteError("Le checkout Stripe est désactivé en mode démo. Activez BILLING_MODE=stripe pour tester.", 409);
    }
    const priceId = this.priceForTier(input.tier);
    const session = await this.stripe.createCheckoutSession({
      customerEmail: workspace.user.email,
      companyId: workspace.company.id,
      priceId,
      successUrl: `${input.origin}/abonnement?checkout=success`,
      cancelUrl: `${input.origin}/abonnement?checkout=cancelled`,
    });
    await this.activity.recordActivity(workspace, {
      action: "billing.checkout_started",
      entityType: "billing",
      entityId: workspace.company.id,
      metadata: { tier: input.tier, sessionId: session.id },
    });
    return session;
  }

  async createCustomerPortalSession(workspace: CompanyWorkspace, input: { origin: string }) {
    if (this.config.billingMode !== "stripe") {
      throw new ExpectedRouteError("Le portail Stripe est désactivé en mode démo.", 409);
    }
    const subscription = await this.subscriptions.getSubscription(workspace);
    if (!subscription.stripeCustomerId) throw new ExpectedRouteError("Aucun client Stripe associé à cette entreprise.", 409);
    const session = await this.stripe.createCustomerPortalSession({
      customerId: subscription.stripeCustomerId,
      returnUrl: `${input.origin}/abonnement`,
    });
    await this.activity.recordActivity(workspace, {
      action: "billing.portal_opened",
      entityType: "billing",
      entityId: workspace.company.id,
      metadata: { sessionId: session.id },
    });
    return session;
  }

  private priceForTier(tier: SubscriptionTier) {
    if (tier === "ENTREPRISE_PLUS" && this.config.stripePriceEntreprisePlus) return this.config.stripePriceEntreprisePlus;
    if (tier === "ENTREPRISE" && this.config.stripePriceEntreprise) return this.config.stripePriceEntreprise;
    if (tier === "SOLO" && this.config.stripePriceSolo) return this.config.stripePriceSolo;
    throw new ExpectedRouteError(`Prix Stripe manquant pour le plan ${tier}.`, 500);
  }
}

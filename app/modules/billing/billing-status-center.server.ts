import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { getRuntimeConfig, type RuntimeConfig } from "../runtime-config.server";
import { EntitlementGate } from "./entitlement-gate.server";
import { UsageMeter } from "./usage-meter.server";

export class BillingStatusCenter {
  constructor(
    private readonly config: RuntimeConfig = getRuntimeConfig(),
    private readonly usage = new UsageMeter(),
    private readonly entitlements = new EntitlementGate()
  ) {}

  async getBillingStatus(workspace: CompanyWorkspace) {
    const [usage, chat, imports, latestWebhookEvents] = await Promise.all([
      this.usage.getUsageSummary(workspace),
      this.entitlements.getEntitlementStatus(workspace, "chat"),
      this.entitlements.getEntitlementStatus(workspace, "import"),
      prisma.billingWebhookEvent.findMany({
        orderBy: { receivedAt: "desc" },
        take: 5,
      }),
    ]);
    return {
      mode: this.config.billingMode,
      subscription: usage.subscription,
      usage,
      entitlements: {
        chat: summarizeEntitlement(chat),
        import: summarizeEntitlement(imports),
      },
      stripeReadiness: {
        enabled: this.config.billingMode === "stripe",
        hasSecretKey: Boolean(this.config.stripeSecretKey),
        hasWebhookSecret: Boolean(this.config.stripeWebhookSecret),
        hasPrices: Boolean(this.config.stripePriceSolo && this.config.stripePriceEntreprise && this.config.stripePriceEntreprisePlus),
      },
      latestWebhookEvents: latestWebhookEvents.map((event) => ({
        id: event.id,
        eventId: event.eventId,
        eventType: event.eventType,
        status: event.status,
        receivedAt: event.receivedAt.toISOString(),
        processedAt: event.processedAt?.toISOString() ?? null,
        errorMessage: event.errorMessage,
      })),
    };
  }
}

function summarizeEntitlement(input: Awaited<ReturnType<EntitlementGate["getEntitlementStatus"]>>) {
  return {
    allowed: input.allowed,
    blockedReason: input.blockedReason,
    kind: input.kind,
  };
}

import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { EntitlementGate } from "../app/modules/billing/entitlement-gate.server";
import { getPeriodKey } from "../app/modules/billing/usage-meter.server";
import { StripeBillingAdapter } from "../app/modules/billing/stripe-billing-adapter.server";
import { tierLimits } from "../app/modules/billing/subscription-center.server";
import { ExpectedRouteError } from "../app/modules/route-errors.server";
import { getRuntimeConfig } from "../app/modules/runtime-config.server";

describe("Phase 9 billing Modules", () => {
  it("defines beta tier limits", () => {
    expect(tierLimits("SOLO")).toMatchObject({ requestsPerMinute: 60, aiCallsPerMonth: 100, importsPerMonth: 5 });
    expect(tierLimits("ENTREPRISE")).toMatchObject({ requestsPerMinute: 120, aiCallsPerMonth: 300, importsPerMonth: 15 });
    expect(tierLimits("ENTREPRISE_PLUS")).toMatchObject({ requestsPerMinute: 200, aiCallsPerMonth: 1000, importsPerMonth: 50 });
  });

  it("blocks a capability when UsageMeter reports quota exceeded", async () => {
    const usage = {
      async wouldExceed() {
        return true;
      },
      async wouldExceedRateLimit() {
        return false;
      },
      async getUsageSummary() {
        return {
          periodKey: "2026-05",
          usage: { aiCalls: 100, chatMessages: 100, aiCategorizations: 0, imports: 0 },
          remaining: { aiCalls: 0, imports: 5 },
          rateLimit: { requestsLastMinute: 0, limit: 60, remaining: 60 },
          subscription: { limits: tierLimits("SOLO") },
        };
      },
    };
    const activity = { async recordActivity() {} };
    const gate = new EntitlementGate(usage as never, activity as never);

    await expect(gate.assertCanUse({ company: { id: "cmp_1" } } as never, "chat")).rejects.toBeInstanceOf(ExpectedRouteError);
  });

  it("blocks a capability when the minute rate limit is exceeded", async () => {
    const usage = {
      async wouldExceed() {
        return false;
      },
      async wouldExceedRateLimit() {
        return true;
      },
      async getUsageSummary() {
        return {
          periodKey: "2026-05",
          usage: { aiCalls: 0, chatMessages: 0, aiCategorizations: 0, imports: 0 },
          remaining: { aiCalls: 100, imports: 5 },
          rateLimit: { requestsLastMinute: 60, limit: 60, remaining: 0 },
          subscription: { limits: tierLimits("SOLO") },
        };
      },
    };
    const activity = { async recordActivity() {} };
    const gate = new EntitlementGate(usage as never, activity as never);

    await expect(gate.assertCanUse({ company: { id: "cmp_1" } } as never, "chat")).rejects.toMatchObject({ status: 429 });
  });

  it("builds stable monthly period keys", () => {
    expect(getPeriodKey(new Date("2026-05-19T10:00:00.000Z"))).toBe("2026-05");
  });

  it("verifies Stripe webhook signatures without a Stripe SDK dependency", () => {
    const body = JSON.stringify({ id: "evt_1", type: "checkout.session.completed", data: { object: {} } });
    const secret = "whsec_test";
    const timestamp = "1779184800";
    const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
    const adapter = new StripeBillingAdapter({
      ...getRuntimeConfig({ DATABASE_URL: "postgresql://localhost:5432/paperasse" }),
      billingMode: "stripe",
      stripeWebhookSecret: secret,
      stripeSecretKey: "sk_test",
      stripePriceSolo: "price_solo",
      stripePriceEntreprise: "price_entreprise",
      stripePriceEntreprisePlus: "price_plus",
      authMode: "dev",
      databaseUrl: "postgresql://localhost:5432/paperasse",
      aiProvider: "codex-cli",
      codexCliBin: "codex",
      codexModel: "gpt-5.4-mini",
      openAiModel: "gpt-4o-mini",
      openAiApiKey: undefined,
      clerkPublishableKey: undefined,
      clerkSecretKey: undefined,
      clerkWebhookSecret: undefined,
      paperasseRepoPath: "./vendor/paperasse",
      documentStorageDir: "storage/documents",
      enablePdfGeneration: false,
      importExecutionMode: "inline",
      redisUrl: "redis://localhost:6379",
      chatProvider: "codex-cli",
      chatModel: "gpt-5.4-mini",
    });

    expect(adapter.verifyWebhook(body, `t=${timestamp},v1=${signature}`)).toMatchObject({ id: "evt_1" });
    expect(() => adapter.verifyWebhook(body, `t=${timestamp},v1=bad`)).toThrow("Signature Stripe refusée");
  });
});

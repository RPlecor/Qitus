import { describe, expect, it } from "vitest";
import { ConnectorSyncCenter } from "../app/modules/reconciliations/connector-sync-center.server";
import { absMoney, daysBetween, money } from "../app/modules/reconciliations/reconciliation-core.server";
import { buildReconciliationRunFreshness } from "../app/modules/reconciliations/reconciliation-freshness-center.server";
import { getRuntimeConfig } from "../app/modules/runtime-config.server";

describe("reconciliation core helpers", () => {
  it("rounds and compares accounting amounts deterministically", () => {
    expect(money(12.345)).toBe(12.35);
    expect(absMoney("-45.00")).toBe(45);
  });

  it("computes date distance in whole days", () => {
    expect(daysBetween(new Date("2025-03-03"), new Date("2025-03-01"))).toBe(2);
    expect(daysBetween(new Date("2025-03-01"), new Date("2025-03-03"))).toBe(-2);
  });
});

describe("ReconciliationFreshnessCenter", () => {
  it("marks a run stale when dependencies are newer", () => {
    const freshness = buildReconciliationRunFreshness(
      "BANK",
      new Date("2025-12-31T10:00:00.000Z"),
      new Date("2025-12-31T11:00:00.000Z"),
      ["Une écriture a été créée ou modifiée après le rapprochement."]
    );
    expect(freshness).toMatchObject({
      status: "stale",
      label: "À relancer",
      latestDependencyAt: "2025-12-31T11:00:00.000Z",
    });
  });

  it("keeps a run fresh without stale reasons", () => {
    const freshness = buildReconciliationRunFreshness("STRIPE", new Date("2025-12-31T12:00:00.000Z"), null, []);
    expect(freshness.status).toBe("fresh");
    expect(freshness.label).toBe("À jour");
  });
});

describe("ConnectorSyncCenter", () => {
  it("reports connector status without exposing secrets", () => {
    const center = new ConnectorSyncCenter({
      ...getRuntimeConfig({ DATABASE_URL: "postgresql://localhost:5432/paperasse" }),
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
      billingMode: "stub",
      stripeSecretKey: undefined,
      stripeWebhookSecret: undefined,
      stripePriceSolo: undefined,
      stripePriceEntreprise: undefined,
      stripePriceEntreprisePlus: undefined,
      connectorsMode: "live",
      qontoId: "org_secret",
      qontoApiSecret: "qonto_secret",
      stripeConnectorSecret: "stripe_secret",
    });
    const status = center.getConnectorStatus();
    const serialized = JSON.stringify(status);
    expect(serialized).not.toContain("qonto_secret");
    expect(serialized).not.toContain("stripe_secret");
    expect(status.connectors.every((connector) => connector.configured)).toBe(true);
  });
});

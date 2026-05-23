import { describe, expect, it } from "vitest";
import { ConnectorProductSurfaceCenter } from "../app/modules/connectors/connector-product-surface-center.server";
import { getRuntimeConfig } from "../app/modules/runtime-config.server";

const workspace = { company: { id: "company_1" }, fiscalYear: { id: "fy_1" } };
const baseConfig = {
  ...getRuntimeConfig({ DATABASE_URL: "postgresql://localhost:5432/qitus" }),
  connectorsMode: "fixture",
  openBankingProvider: "mock",
  eInvoiceProvider: "mock",
};

describe("ConnectorProductSurfaceCenter", () => {
  it("hides technical test provider names from the product surface by default", async () => {
    const surface = await center({ ...baseConfig, qitusInternalTestMode: false }).getConnectorOverview(workspace as never);
    const serialized = JSON.stringify(surface).toLowerCase();

    expect(surface.internalTest.enabled).toBe(false);
    expect(serialized).not.toContain("mock");
    expect(serialized).not.toContain("fixture");
    expect(serialized).not.toContain("sandbox");
    expect(serialized).not.toContain("generic_pa");
    expect(serialized).not.toContain("adapter");
    expect(surface.cards.map((card) => card.label)).toEqual(["Qonto bancaire", "Open Banking", "Stripe", "Qonto PA"]);
  });

  it("exposes manual test actions only in internal test mode", async () => {
    const surface = await center({ ...baseConfig, qitusInternalTestMode: true }).getConnectorOverview(workspace as never);

    expect(surface.internalTest.enabled).toBe(true);
    expect(surface.internalTest.banner).toContain("Données simulées");
    expect(surface.internalTest.actions.map((action) => action.label)).toContain("Tester un flux bancaire");
    expect(surface.internalTest.actions.map((action) => action.label)).toContain("Tester un payout Stripe");
    expect(surface.internalTest.actions.map((action) => action.label)).toContain("Tester une facture entrante");
  });
});

function center(config: typeof baseConfig) {
  return new ConnectorProductSurfaceCenter(
    config as never,
    {
      getConnectorStatus: () => ({
        mode: "fixture",
        connectors: [
          { provider: "qonto", enabled: true, configured: true, message: "Mode fixture", safeMessage: "Mode fixture", source: "fixture", lastSync: null },
          { provider: "stripe", enabled: true, configured: true, message: "Mode fixture", safeMessage: "Mode fixture", source: "fixture", lastSync: null },
        ],
      }),
    } as never,
    {
      getStatus: async () => ({
        provider: "mock",
        providerLabel: "Open Banking mock",
        selectionMode: "institution_select",
        enabled: true,
        configured: true,
        message: "Open Banking mock actif.",
        safeMessage: "Open Banking mock actif.",
        supportsInstitutions: true,
        connections: [],
        latestSyncs: [],
      }),
    } as never,
    {
      getStatus: async () => ({
        provider: "mock",
        providerLabel: "PA mock Qitus",
        mode: "mock",
        configured: true,
        receptionCompliant: false,
        safeMessage: "Provider mock prêt.",
        missingConfig: [],
        capabilities: ["guarded_adapter"],
        readiness: { status: "configured", receptionCompliant: false, message: "mock ready", recommendedAction: "utiliser le mock" },
        connections: [],
        syncEvents: [],
      }),
    } as never,
    {
      getReadiness: async () => ({
        status: "contract_missing",
        provider: "qonto_pa",
        providerLabel: "Qonto PA",
        receptionCompliant: false,
        message: "Contrat manquant",
        recommendedAction: "Obtenir contrat",
        checks: [],
      }),
    } as never,
    {
      getReadiness: async () => ({
        status: "warning",
        summary: { ready: 1, total: 2, warnings: 1, blocked: 0 },
        checks: [{ code: "provider", label: "Provider", status: "warning", message: "mock à remplacer", action: "désactiver mock" }],
      }),
    } as never
  );
}

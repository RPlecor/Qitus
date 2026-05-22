import { describe, expect, it } from "vitest";
import { buildVatLedgerReadiness } from "../app/modules/vat/vat-ledger-readiness-center.server";
import { VatNotificationSource } from "../app/modules/notifications/notification-sources.server";

describe("VatLedgerReadinessCenter", () => {
  it("returns ok in franchise", () => {
    const readiness = buildVatLedgerReadiness(snapshot({ vatRegime: "FRANCHISE", importEntries: 8 }));

    expect(readiness).toMatchObject({
      status: "ok",
      title: "TVA non applicable",
    });
  });

  it("requires action in a real VAT regime when import entries have no VAT lines", () => {
    const readiness = buildVatLedgerReadiness(snapshot({
      vatRegime: "REEL_NORMAL",
      parsedImports: 1,
      importEntries: 40,
      importEntriesWithVat: 0,
      importEntriesWithoutVat: 40,
      taxableCategorizations: 12,
    }));

    expect(readiness.status).toBe("action_required");
    expect(readiness.message).toContain("44566");
    expect(readiness.actions[0]).toMatchObject({ href: "/imports", primary: true });
  });

  it("warns while imports or transactions are still in review", () => {
    const readiness = buildVatLedgerReadiness(snapshot({
      vatRegime: "REEL_NORMAL",
      parsedImports: 1,
      reviewImports: 1,
      transactionsInReview: 3,
    }));

    expect(readiness).toMatchObject({
      status: "warning",
      title: "TVA à finaliser après revue des transactions",
    });
  });

  it("returns ok when VAT journal lines exist", () => {
    const readiness = buildVatLedgerReadiness(snapshot({
      vatRegime: "REEL_NORMAL",
      parsedImports: 1,
      importEntries: 40,
      importEntriesWithVat: 18,
      importEntriesWithoutVat: 22,
      taxableCategorizations: 0,
    }));

    expect(readiness.status).toBe("ok");
  });
});

describe("VatNotificationSource", () => {
  it("creates a deduplicated VAT alert when ledger readiness is not ok", async () => {
    const source = new VatNotificationSource(
      { async getVatReview() { return { controls: [], blockingCount: 0, warningCount: 0, status: "ready" }; } } as never,
      { async getReadiness() { return buildVatLedgerReadiness(snapshot({ vatRegime: "REEL_NORMAL", parsedImports: 1, importEntries: 1, importEntriesWithoutVat: 1 })); } } as never
    );

    const specs = await source.listNotificationSpecs({} as never);

    expect(specs).toContainEqual(expect.objectContaining({
      type: "VAT_ALERT",
      dedupeKey: "vat:ledger-readiness",
      href: "/tva",
    }));
  });
});

function snapshot(overrides: Partial<Parameters<typeof buildVatLedgerReadiness>[0]> = {}): Parameters<typeof buildVatLedgerReadiness>[0] {
  return {
    vatRegime: "REEL_NORMAL",
    parsedImports: 0,
    reviewImports: 0,
    importEntries: 0,
    importEntriesWithVat: 0,
    importEntriesWithoutVat: 0,
    taxableCategorizations: 0,
    zeroVatDeclarations: 0,
    transactionsInReview: 0,
    ...overrides,
  };
}

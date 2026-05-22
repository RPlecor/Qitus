import { describe, expect, it } from "vitest";
import { buildVatDeclarationFreshness } from "../app/modules/vat/vat-declaration-freshness-center.server";

describe("VatDeclarationFreshnessCenter", () => {
  it("marks draft declarations stale after newer VAT business events", () => {
    const freshness = buildVatDeclarationFreshness([
      declaration("dec_1", "DRAFT", "2025-01-01T00:00:00.000Z"),
      declaration("dec_2", "SUPERSEDED", "2025-01-02T00:00:00.000Z"),
    ], [
      { code: "transaction_corrected", label: "Dernière correction TVA", at: "2025-01-03T00:00:00.000Z" },
    ]);

    expect(freshness.declarations[0]).toMatchObject({
      declarationId: "dec_1",
      active: false,
      isStale: true,
      lifecycleStatus: "stale",
      statusLabel: "Obsolète",
    });
    expect(freshness.declarations[1]).toMatchObject({
      declarationId: "dec_2",
      active: false,
      isStale: false,
      lifecycleStatus: "superseded",
    });
    expect(freshness.staleCount).toBe(1);
  });
});

function declaration(id: string, status: "DRAFT" | "SUPERSEDED", createdAt: string) {
  return {
    id,
    type: "CA12" as const,
    status,
    periodStart: new Date("2025-01-01"),
    periodEnd: new Date("2025-12-31"),
    createdAt: new Date(createdAt),
  };
}

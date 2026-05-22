import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  correctionRule: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
  transaction: {
    findMany: vi.fn(),
  },
}));

vi.mock("../app/modules/db.server", () => ({ prisma: prismaMock }));

import { CorrectionRuleImpactCenter } from "../app/modules/correction-rules/correction-rule-impact-center.server";

describe("CorrectionRuleImpactCenter", () => {
  beforeEach(() => {
    prismaMock.correctionRule.findMany.mockReset();
    prismaMock.correctionRule.findFirst.mockReset();
    prismaMock.transaction.findMany.mockReset();
  });

  it("previews matched transactions and conflicting rules", async () => {
    prismaMock.correctionRule.findMany.mockResolvedValue([
      { id: "rule_2", counterparty: "stripe payout", preferredAccount: "471", active: true },
    ]);
    prismaMock.transaction.findMany.mockResolvedValue([
      transaction("tx_1", "STRIPE PAYOUT MARS"),
      transaction("tx_2", "OVH CLOUD"),
    ]);

    const impact = await new CorrectionRuleImpactCenter().previewDraftRuleImpact(workspace(), {
      counterparty: "stripe",
      preferredAccount: "471",
    });

    expect(impact.count).toBe(1);
    expect(impact.transactions[0].id).toBe("tx_1");
    expect(impact.conflicts[0].counterparty).toBe("stripe payout");
    expect(impact.health).toBe("conflict");
  });

  it("warns when a draft rule is too broad", async () => {
    prismaMock.correctionRule.findMany.mockResolvedValue([]);
    prismaMock.transaction.findMany.mockResolvedValue([
      transaction("tx_1", "A"),
      transaction("tx_2", "A"),
      transaction("tx_3", "A"),
      transaction("tx_4", "B"),
    ]);

    const impact = await new CorrectionRuleImpactCenter().previewDraftRuleImpact(workspace(), {
      counterparty: "A",
      preferredAccount: "471",
    });

    expect(impact.health).toBe("broad");
    expect(impact.warnings.join(" ")).toContain("trop large");
  });
});

function workspace() {
  return { fiscalYear: { id: "fy_1" } } as never;
}

function transaction(id: string, label: string) {
  return {
    id,
    date: new Date("2025-03-31T00:00:00.000Z"),
    label,
    normalizedLabel: label.toLowerCase(),
    counterparty: label,
    amount: "-10",
  };
}

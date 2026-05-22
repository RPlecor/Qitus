import { describe, expect, it } from "vitest";
import { buildEvidenceRequirements, summarizeEvidenceRequirements } from "../app/modules/accounting-coverage/evidence-requirement-center.server";

describe("EvidenceRequirementCenter", () => {
  it("detects imported journal entries without supporting evidence", () => {
    const requirements = buildEvidenceRequirements([
      entry({ id: "entry_1", source: "IMPORT", transactions: [{ id: "tx_1", amount: decimal(-120) }] }),
    ], { fiscalYearId: "fy_1", hasExpertValidation: false });

    expect(requirements).toContainEqual(expect.objectContaining({
      entityType: "transaction",
      entityId: "tx_1",
      kind: "invoice",
      level: "required",
      missing: true,
    }));
  });

  it("distinguishes required, recommended and missing evidence", () => {
    const requirements = buildEvidenceRequirements([
      entry({ id: "entry_1", source: "CLOSING_ADJUSTMENT", closingAdjustmentProposal: { id: "p_1", proposalKey: "CCA:x" } }),
      entry({ id: "entry_2", source: "IMPORT", transactions: [] }),
    ], { fiscalYearId: "fy_1", hasExpertValidation: true });
    const summary = summarizeEvidenceRequirements(requirements);

    expect(summary.requiredMissing).toBe(1);
    expect(summary.recommendedMissing).toBe(1);
    expect(summary.byKind.user_decision).toBe(1);
    expect(summary.byKind.bank_statement).toBe(1);
    expect(summary.byKind.expert_validation).toBe(0);
  });

  it("marks a requirement as satisfied when a compatible attachment link exists", () => {
    const requirements = buildEvidenceRequirements([
      entry({ id: "entry_1", source: "IMPORT", transactions: [{ id: "tx_1", amount: decimal(-120) }] }),
    ], {
      fiscalYearId: "fy_1",
      hasExpertValidation: false,
      links: [{ entityType: "TRANSACTION", entityId: "tx_1", relationType: "INVOICE" }],
    });
    const transactionRequirement = requirements.find((requirement) => requirement.entityId === "tx_1");

    expect(transactionRequirement).toMatchObject({ missing: false, kind: "invoice" });
    expect(summarizeEvidenceRequirements(requirements).satisfied).toBe(1);
  });

  it("creates requirements for draft closing proposals before journal entry approval", () => {
    const requirements = buildEvidenceRequirements([], {
      fiscalYearId: "fy_1",
      hasExpertValidation: true,
      draftProposals: [{
        id: "proposal_1",
        proposalKey: "CLOSING_WORKPAPER:FNP:wp_1",
        kind: "FNP",
        label: "FNP hébergement",
        status: "DRAFT",
        calculationJson: { requiredEvidence: true },
        journalEntryId: null,
      }],
      links: [{ entityType: "CLOSING_ADJUSTMENT", entityId: "CLOSING_WORKPAPER:FNP:wp_1", relationType: "USER_DECISION" }],
    });

    expect(requirements).toContainEqual(expect.objectContaining({
      entityType: "closing_adjustment",
      entityId: "CLOSING_WORKPAPER:FNP:wp_1",
      level: "required",
      missing: false,
    }));
  });
});

function entry(overrides: Partial<{
  id: string;
  num: number;
  journal: string;
  label: string;
  source: "IMPORT" | "MANUAL" | "CLOSING_ADJUSTMENT";
  transactions: Array<{ id: string; amount: { toNumber(): number } }>;
  closingAdjustmentProposal: { id: string; proposalKey: string } | null;
}>) {
  return {
    id: "entry",
    num: 1,
    journal: "BQ",
    label: "Transaction",
    source: "IMPORT" as const,
    transactions: [],
    closingAdjustmentProposal: null,
    ...overrides,
  };
}

function decimal(value: number) {
  return { toNumber: () => value };
}

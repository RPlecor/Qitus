import { describe, expect, it } from "vitest";
import {
  closingAdjustmentRequiresEvidence,
  summarizeClosingAdjustmentEvidence,
  workpaperKeyFromClosingProposalKey,
} from "../app/modules/closing-adjustments/closing-adjustment-evidence.server";
import { summarizeClosingAdjustmentReviews } from "../app/modules/closing-adjustments/closing-adjustment-review-workflow.server";

describe("ClosingAdjustmentReviewWorkflow", () => {
  it("requires evidence for generalized closing adjustments", () => {
    expect(closingAdjustmentRequiresEvidence({ kind: "FNP" as never, calculation: {} })).toBe(true);
    expect(closingAdjustmentRequiresEvidence({ kind: "VAT_SETTLEMENT" as never, calculation: {} })).toBe(false);
    expect(closingAdjustmentRequiresEvidence({ kind: "VAT_SETTLEMENT" as never, calculation: { requiredEvidence: true } })).toBe(true);
  });

  it("accepts attachment evidence linked by proposal key", () => {
    const evidence = summarizeClosingAdjustmentEvidence(proposal(), [
      {
        id: "link_1",
        entityType: "CLOSING_ADJUSTMENT",
        entityId: "CLOSING_WORKPAPER:FNP:wp_1",
        relationType: "USER_DECISION",
        createdAt: new Date("2026-05-21T10:00:00Z"),
        attachment: { id: "att_1", originalFilename: "decision.txt", status: "EXTRACTED" },
      },
    ]);

    expect(evidence.missing).toBe(false);
    expect(evidence.links[0]).toMatchObject({ filename: "decision.txt", relationType: "USER_DECISION" });
  });

  it("summarizes ready, stale and evidence-blocked proposals", () => {
    const summary = summarizeClosingAdjustmentReviews([
      review({ canApprove: true }),
      review({ freshness: { stale: true }, evidence: { missing: false } }),
      review({ evidence: { missing: true } }),
      review({ proposal: { status: "APPROVED" } }),
      review({ proposal: { status: "REJECTED" } }),
    ] as never);

    expect(summary).toMatchObject({
      total: 5,
      draft: 3,
      ready: 1,
      stale: 1,
      approved: 1,
      rejected: 1,
      evidenceMissing: 1,
    });
  });

  it("extracts workpaper key from generalized proposal keys", () => {
    expect(workpaperKeyFromClosingProposalKey("CLOSING_WORKPAPER:FNP:wp:with:colons")).toBe("wp:with:colons");
    expect(workpaperKeyFromClosingProposalKey("CCA:legacy")).toBeNull();
  });
});

function proposal() {
  return {
    id: "proposal_1",
    proposalKey: "CLOSING_WORKPAPER:FNP:wp_1",
    journalEntryId: null,
    kind: "FNP" as never,
    calculation: { requiredEvidence: true },
  };
}

function review(overrides: Record<string, unknown>) {
  return {
    proposal: { status: "DRAFT", proposalKey: "p", kind: "FNP" },
    freshness: { stale: false },
    evidence: { missing: false },
    canApprove: false,
    blockingReasons: [],
    ...overrides,
  };
}

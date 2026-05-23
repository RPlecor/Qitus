import { describe, expect, it } from "vitest";
import { buildCoverageOverview, type AccountingCoverageSnapshot } from "../app/modules/accounting-coverage/accounting-coverage-center.server";

describe("AccountingCoverageCenter", () => {
  it("classifies the MVP demo as partial with expert-comptable gaps", () => {
    const overview = buildCoverageOverview(snapshot({
      transactionCount: 42,
      reviewTransactionCount: 2,
      categorizationCount: 42,
      journalEntryCount: 40,
      journalLineCount: 80,
      missingEvidence: evidenceSummary({ total: 41, missing: 41, requiredMissing: 40, recommendedMissing: 1 }),
      documentTypes: [],
      stripeCandidateCount: 1,
      activityCount: 10,
    }));

    expect(overview.status).toBe("blocked");
    expect(overview.label).toBe("Couverture EC à risque");
    expect(overview.areas.find((area) => area.code === "evidence")).toMatchObject({ status: "partial", risk: "medium" });
    expect(overview.areas.find((area) => area.code === "vat")).toMatchObject({ status: "partial" });
  });

  it("recognizes FEC, documents, closing and expert review when present", () => {
    const overview = buildCoverageOverview(snapshot({
      reviewTransactionCount: 0,
      missingEvidence: evidenceSummary({ total: 1, missing: 0, requiredMissing: 0, recommendedMissing: 0 }),
      documentTypes: ["FEC", "BALANCE", "BILAN", "COMPTE_RESULTAT", "LIASSE_FISCALE"] as never,
      bankReconciliationCount: 1,
      matchedBankReconciliationCount: 1,
      closingRunStatus: "CLOSED",
      closingRunCount: 1,
      expertValidationCount: 1,
      shareLinkCount: 1,
      activityCount: 20,
    }));

    expect(overview.areas.find((area) => area.code === "fec")).toMatchObject({ status: "covered" });
    expect(overview.areas.find((area) => area.code === "documents")).toMatchObject({ status: "covered" });
    expect(overview.areas.find((area) => area.code === "closing")).toMatchObject({ status: "covered" });
    expect(overview.areas.find((area) => area.code === "expert_review")).toMatchObject({ status: "covered" });
  });
});

function snapshot(overrides: Partial<AccountingCoverageSnapshot>): AccountingCoverageSnapshot {
  return {
    transactionCount: 42,
    reviewTransactionCount: 0,
    categorizationCount: 42,
    journalEntryCount: 40,
    journalLineCount: 80,
    journalAuditStatus: "exportable",
    missingEvidence: evidenceSummary(),
    attachmentCount: 0,
    attachmentLinkCount: 0,
    orphanAttachmentCount: 0,
    extractionFailureCount: 0,
    vatRegime: "FRANCHISE",
    vatLineCount: 0,
    vatReview: { status: "ready_with_warnings", blockingCount: 0, warningCount: 1, controls: [{ code: "VAT_FRANCHISE", severity: "warning", title: "Franchise TVA", detail: "Aucune CA3/CA12 à générer.", href: "/tva" }] },
    documentTypes: [],
    staleDocumentCount: 0,
    bankReconciliationCount: 0,
    matchedBankReconciliationCount: 0,
    stripeCandidateCount: 0,
    closingRunStatus: "OPEN",
    closingRunCount: 0,
    approvedClosingAdjustments: 0,
    draftClosingAdjustments: 0,
    rejectedClosingAdjustments: 0,
    closingWorkpaperCount: 0,
    closingWorkpaperDraftCount: 0,
    closingRequiredEvidenceMissing: 0,
    shareLinkCount: 0,
    expertValidationCount: 0,
    activityCount: 0,
    privacyRequestCount: 0,
    ...overrides,
  };
}

function emptyKinds() {
  return {
    invoice: 0,
    receipt: 0,
    bank_statement: 0,
    contract: 0,
    user_decision: 0,
    expert_validation: 0,
  };
}

function evidenceSummary(overrides: Partial<AccountingCoverageSnapshot["missingEvidence"]> = {}) {
  const total = overrides.total ?? 0;
  const missing = overrides.missing ?? 0;
  const requiredMissing = overrides.requiredMissing ?? 0;
  const recommendedMissing = overrides.recommendedMissing ?? 0;
  return {
    total,
    missing,
    requiredMissing,
    recommendedMissing,
    satisfied: total - missing,
    requiredTotal: requiredMissing,
    recommendedTotal: recommendedMissing,
    byKind: emptyKinds(),
    ...overrides,
  };
}

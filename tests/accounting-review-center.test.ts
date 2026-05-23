import { DocumentType, VatRegime } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  assertReviewAllowsDocumentGeneration,
  buildAccountingReview,
  DocumentGenerationBlockedError,
  type AccountingReviewSnapshot,
} from "../app/modules/accounting-review/accounting-review-center.server";

describe("AccountingReviewCenter", () => {
  it("blocks documents while transactions still need review", () => {
    const review = buildAccountingReview({
      ...baseSnapshot(),
      transactionsInReview: [
        { label: "VIREMENT REF 789456123", amount: "-45.00", account: "471" },
        { label: "DEPOT COMPTES ANNUELS 2024", amount: "-220.00", account: "471" },
      ],
    });

    expect(review.status).toBe("blocked");
    expect(review.blockingCount).toBe(1);
    expect(review.controls[0]).toMatchObject({
      code: "UNCORRECTED_TRANSACTIONS",
      severity: "blocking",
      title: "2 transactions à corriger",
    });
    expect(() => assertReviewAllowsDocumentGeneration(review)).toThrow(DocumentGenerationBlockedError);
  });

  it("becomes ready with warnings once blocking controls are cleared", () => {
    const review = buildAccountingReview({
      ...baseSnapshot(),
      documents: [{ type: DocumentType.FEC, generatedAt: new Date("2025-04-01") }],
      annualChargeCandidates: [{ label: "ASSURANCE RC PRO ANNUELLE", amount: "-540.00", account: "6161" }],
      fixedAssetCandidates: [{ label: "MACBOOK PRO 14 M3", amount: "-1899.00", account: "2183" }],
      stripeCandidates: [{ label: "PAYOUT MARS 2025", amount: "1200.00", account: "511" }],
      revenue: 35_900,
      hasBankEntries: true,
    });

    expect(review.status).toBe("ready_with_warnings");
    expect(review.blockingCount).toBe(0);
    expect(review.controls.map((control) => control.code)).toEqual([
      "MISSING_STATEMENTS",
      "ANNUAL_CHARGE_CCA",
      "FIXED_ASSET_CANDIDATE",
      "VAT_THRESHOLD",
      "STRIPE_RECONCILIATION",
      "BANK_RECONCILIATION",
    ]);
    expect(() => assertReviewAllowsDocumentGeneration(review)).not.toThrow();
  });

  it("flags generated documents older than accounting changes", () => {
    const review = buildAccountingReview({
      ...baseSnapshot(),
      documents: [
        { type: DocumentType.FEC, generatedAt: new Date("2025-03-01") },
        { type: DocumentType.BALANCE, generatedAt: new Date("2025-03-01") },
        { type: DocumentType.BILAN, generatedAt: new Date("2025-03-01") },
        { type: DocumentType.COMPTE_RESULTAT, generatedAt: new Date("2025-03-01") },
      ],
      latestAccountingChangeAt: new Date("2025-03-15"),
    });

    expect(review.controls.map((control) => control.code)).toContain("DOCUMENTS_OUTDATED");
  });

  it("excludes resolved or ignored tracked issues from active warnings", () => {
    const snapshot: AccountingReviewSnapshot = {
      ...baseSnapshot(),
      documents: [{ type: DocumentType.FEC, generatedAt: new Date("2025-04-01") }],
      annualChargeCandidates: [
        { issueKey: "ANNUAL_CHARGE_CCA:transaction:txn_1", label: "AXA", amount: "-540.00", account: "6161" },
        { issueKey: "ANNUAL_CHARGE_CCA:transaction:txn_2", label: "CANVA", amount: "-35.90", account: "6135" },
      ],
      issueResolutions: [
        { issueKey: "ANNUAL_CHARGE_CCA:transaction:txn_1", controlCode: "ANNUAL_CHARGE_CCA", status: "RESOLVED", note: "Calcul CCA revu." },
      ],
    };

    const activeReview = buildAccountingReview(snapshot);
    const fullReview = buildAccountingReview(snapshot, { includeHandledIssues: true });

    expect(activeReview.controls.find((control) => control.code === "ANNUAL_CHARGE_CCA")?.evidence).toHaveLength(1);
    expect(activeReview.controls.find((control) => control.code === "ANNUAL_CHARGE_CCA")?.evidence[0].label).toBe("CANVA");
    expect(fullReview.controls.find((control) => control.code === "ANNUAL_CHARGE_CCA")).toMatchObject({
      openIssueCount: 1,
      handledIssueCount: 1,
    });
  });
});

function baseSnapshot(): AccountingReviewSnapshot {
  return {
    company: { vatRegime: VatRegime.FRANCHISE },
    documents: [],
    latestAccountingChangeAt: null,
    transactionsInReview: [],
    confirmedTransactionsWithoutEntry: [],
    annualChargeCandidates: [],
    fixedAssetCandidates: [],
    stripeCandidates: [],
    revenue: 0,
    hasBankEntries: false,
  };
}

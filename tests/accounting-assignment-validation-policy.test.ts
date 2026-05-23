import { describe, expect, it } from "vitest";
import { AccountingAssignmentValidationPolicy } from "../app/modules/accounting-reference/accounting-assignment-validation-policy.server";

const transaction = {
  id: "tx_1",
  date: "2026-01-10",
  label: "OVH CLOUD",
  normalizedLabel: "ovh cloud",
  amount: -120,
  currency: "EUR",
  type: "DEBIT" as const,
};

describe("AccountingAssignmentValidationPolicy", () => {
  it("validates known PCG accounts and enriches labels", () => {
    const result = new AccountingAssignmentValidationPolicy().validateSuggestion({ vatRegime: "REEL_NORMAL" }, {
      transactionId: "tx_1",
      accountDebit: "6135",
      accountCredit: "5121",
      journal: "BQ",
      ecritureLabel: "OVH - cloud",
      vatRate: 0.2,
      vatOperationNature: "DOMESTIC_PURCHASE",
      confidence: "HIGH",
      source: "VENDOR_LOOKUP",
    }, transaction);

    expect(result).toMatchObject({
      status: "VALIDATED",
      valid: true,
      chartVersion: "ANC-PCG-2026-01-01",
      accountDebitLabel: "Locations mobilières",
      accountCreditLabel: "Comptes en euros",
    });
  });

  it("blocks unknown accounts before ledger creation", () => {
    const result = new AccountingAssignmentValidationPolicy().validateSuggestion({ vatRegime: "FRANCHISE" }, {
      transactionId: "tx_1",
      accountDebit: "6259",
      accountCredit: "5121",
      journal: "BQ",
      ecritureLabel: "Transaction",
      confidence: "HIGH",
      source: "AI",
    }, transaction);

    expect(result.status).toBe("BLOCKED");
    expect(result.blockingReasons[0]).toContain("Compte débit 6259 non reconnu");
  });

  it("forces suspense accounts into review even when they are known", () => {
    const result = new AccountingAssignmentValidationPolicy().validateSuggestion({ vatRegime: "FRANCHISE" }, {
      transactionId: "tx_1",
      accountDebit: "471",
      accountCredit: "5121",
      journal: "BQ",
      ecritureLabel: "Transaction",
      confidence: "LOW",
      source: "AI",
    }, transaction);

    expect(result).toMatchObject({ status: "NEEDS_REVIEW", valid: true, reviewRequired: true });
    expect(result.warnings).toContain("Compte d'attente à vérifier avant finalisation du dossier.");
  });
});

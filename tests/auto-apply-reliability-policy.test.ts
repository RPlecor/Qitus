import { describe, expect, it } from "vitest";
import { AutoApplyReliabilityPolicy, type SupplierCategorizationHistoryItem } from "../app/modules/accounting-reference/auto-apply-reliability-policy.server";
import { CompanyProfileClassificationCenter } from "../app/modules/accounting-reference/company-profile-classification-center.server";
import type { AccountingAssignmentValidationResult } from "../app/modules/accounting-reference/accounting-assignment-validation-policy.server";
import type { CategorizationSuggestion, CategorizationTransaction } from "../app/modules/categorization/types";

const validation: AccountingAssignmentValidationResult = {
  status: "VALIDATED",
  valid: true,
  reviewRequired: false,
  blockingReasons: [],
  warnings: [],
  chartVersion: "ANC-PCG-2026-01-01",
};

const suggestion: CategorizationSuggestion = {
  transactionId: "tx_1",
  accountDebit: "626",
  accountCredit: "5121",
  journal: "BQ",
  ecritureLabel: "Orange",
  confidence: "HIGH",
  source: "AI",
  vatRate: null,
  vatOperationNature: null,
};

const transaction: CategorizationTransaction = {
  id: "tx_1",
  date: "2026-01-10",
  label: "ORANGE MOBILE",
  normalizedLabel: "orange mobile",
  counterparty: "Orange",
  amount: -42,
  currency: "EUR",
  type: "DEBIT",
};

const history: SupplierCategorizationHistoryItem[] = [
  { accountDebit: "626", accountCredit: "5121", vatRate: null, vatOperationNature: null, amount: -41, status: "AUTO_APPLIED", source: "AI" },
  { accountDebit: "626", accountCredit: "5121", vatRate: null, vatOperationNature: null, amount: -43, status: "USER_CONFIRMED", source: "MANUAL" },
];
const classifier = new CompanyProfileClassificationCenter();
const tier1 = classifier.classifyCompanyProfile({ legalForm: "AUTO_ENTREPRENEUR", incomeRegime: null, corporateTax: "IR", vatRegime: "FRANCHISE", hasAccountant: false });
const tier2 = classifier.classifyCompanyProfile({ legalForm: "EI", incomeRegime: "BNC réel", corporateTax: "IR", vatRegime: "REEL_NORMAL", hasAccountant: false });
const tier3 = classifier.classifyCompanyProfile({ legalForm: "SASU", incomeRegime: "BIC réel", corporateTax: "IS", vatRegime: "REEL_NORMAL", hasAccountant: false });
const tier4 = classifier.classifyCompanyProfile({ legalForm: "SARL", incomeRegime: "BIC réel", corporateTax: "IS", vatRegime: "REEL_NORMAL", hasAccountant: true });

describe("AutoApplyReliabilityPolicy", () => {
  it("auto-applies high confidence recurring AI suggestions validated by PCG and simple VAT", () => {
    expect(new AutoApplyReliabilityPolicy().classifyAiSuggestion({
      suggestion,
      validation,
      transaction,
      supplierHistory: history,
      company: { vatRegime: "REEL_NORMAL", vatExigibility: "DEBITS" },
      profile: tier3,
    })).toMatchObject({
      status: "AUTO_APPLIED",
      writable: true,
      userFacingResolution: "auto_applied",
    });
  });

  it("uses light review for high-confidence AI on a new supplier", () => {
    expect(new AutoApplyReliabilityPolicy().classifyAiSuggestion({
      suggestion,
      validation,
      transaction,
      supplierHistory: [],
      company: { vatRegime: "REEL_NORMAL", vatExigibility: "DEBITS" },
      profile: tier3,
    })).toMatchObject({
      status: "REVIEW_LIGHT",
      writable: false,
    });
  });

  it("uses light review for an atypical amount", () => {
    expect(new AutoApplyReliabilityPolicy().classifyAiSuggestion({
      suggestion,
      validation,
      transaction: { ...transaction, amount: -400 },
      supplierHistory: history,
      company: { vatRegime: "REEL_NORMAL", vatExigibility: "DEBITS" },
      profile: tier3,
    })).toMatchObject({ status: "REVIEW_LIGHT" });
  });

  it("requires hard review for medium confidence, complex VAT, assets and contradictory corrections", () => {
    const policy = new AutoApplyReliabilityPolicy();
    expect(policy.classifyAiSuggestion({
      suggestion: { ...suggestion, confidence: "MEDIUM" },
      validation,
      transaction,
      supplierHistory: history,
      company: { vatRegime: "REEL_NORMAL", vatExigibility: "DEBITS" },
      profile: tier3,
    }).status).toBe("NEEDS_REVIEW");
    expect(policy.classifyAiSuggestion({
      suggestion: { ...suggestion, vatRate: 0.2, vatOperationNature: "REVERSE_CHARGE" },
      validation,
      transaction,
      supplierHistory: history,
      company: { vatRegime: "REEL_NORMAL", vatExigibility: "DEBITS" },
      profile: tier3,
    }).status).toBe("NEEDS_REVIEW");
    expect(policy.classifyAiSuggestion({
      suggestion: { ...suggestion, accountDebit: "2183" },
      validation,
      transaction,
      supplierHistory: history,
      company: { vatRegime: "REEL_NORMAL", vatExigibility: "DEBITS" },
      profile: tier3,
    }).status).toBe("NEEDS_REVIEW");
    expect(policy.classifyAiSuggestion({
      suggestion,
      validation,
      transaction,
      supplierHistory: [{ ...history[0], accountDebit: "6226", status: "USER_CORRECTED" }, history[1]],
      company: { vatRegime: "REEL_NORMAL", vatExigibility: "DEBITS" },
      profile: tier3,
    }).status).toBe("NEEDS_REVIEW");
  });

  it("configures confidence and history thresholds by company tier", () => {
    const policy = new AutoApplyReliabilityPolicy();
    expect(policy.classifyAiSuggestion({
      suggestion: { ...suggestion, confidence: "LOW" },
      validation,
      transaction,
      supplierHistory: [],
      company: { vatRegime: "FRANCHISE", vatExigibility: "ENCAISSEMENTS" },
      profile: tier1,
    }).status).toBe("AUTO_APPLIED");

    expect(policy.classifyAiSuggestion({
      suggestion: { ...suggestion, confidence: "MEDIUM" },
      validation,
      transaction,
      supplierHistory: [history[0]],
      company: { vatRegime: "REEL_NORMAL", vatExigibility: "DEBITS" },
      profile: tier2,
    }).status).toBe("AUTO_APPLIED");

    expect(policy.classifyAiSuggestion({
      suggestion: { ...suggestion, confidence: "MEDIUM" },
      validation,
      transaction,
      supplierHistory: [],
      company: { vatRegime: "REEL_NORMAL", vatExigibility: "DEBITS" },
      profile: tier2,
    }).status).toBe("REVIEW_LIGHT");

    expect(policy.classifyAiSuggestion({
      suggestion,
      validation,
      transaction,
      supplierHistory: [history[0]],
      company: { vatRegime: "REEL_NORMAL", vatExigibility: "DEBITS" },
      profile: tier3,
    }).status).toBe("REVIEW_LIGHT");

    expect(policy.classifyAiSuggestion({
      suggestion: { ...suggestion, confidence: "MEDIUM" },
      validation,
      transaction,
      supplierHistory: history,
      company: { vatRegime: "REEL_NORMAL", vatExigibility: "DEBITS" },
      profile: tier3,
    }).status).toBe("NEEDS_REVIEW");

    expect(policy.classifyAiSuggestion({
      suggestion: { ...suggestion, confidence: "MEDIUM" },
      validation,
      transaction,
      supplierHistory: [history[0]],
      company: { vatRegime: "REEL_NORMAL", vatExigibility: "DEBITS" },
      profile: tier4,
    }).status).toBe("AUTO_APPLIED");
  });

  it("keeps sensitive profile-specific cases in review", () => {
    const policy = new AutoApplyReliabilityPolicy();
    expect(policy.classifyAiSuggestion({
      suggestion: { ...suggestion, confidence: "LOW", accountDebit: "108" },
      validation,
      transaction,
      supplierHistory: [],
      company: { vatRegime: "FRANCHISE", vatExigibility: "ENCAISSEMENTS" },
      profile: tier1,
    }).status).toBe("NEEDS_REVIEW");

    expect(policy.classifyAiSuggestion({
      suggestion: { ...suggestion, vatRate: 0.2, vatOperationNature: "INTRACOM_PURCHASE" },
      validation,
      transaction,
      supplierHistory: [],
      company: { vatRegime: "REEL_NORMAL", vatExigibility: "DEBITS" },
      profile: tier1,
    }).status).toBe("NEEDS_REVIEW");

    expect(policy.classifyAiSuggestion({
      suggestion: { ...suggestion, accountDebit: "151", ecritureLabel: "Provision litige" },
      validation,
      transaction,
      supplierHistory: history,
      company: { vatRegime: "REEL_NORMAL", vatExigibility: "DEBITS" },
      profile: tier3,
    }).status).toBe("NEEDS_REVIEW");

    expect(policy.classifyAiSuggestion({
      suggestion: { ...suggestion, accountDebit: "626", ecritureLabel: "Charge courante" },
      validation,
      transaction: { ...transaction, amount: -900 },
      supplierHistory: [
        { ...history[0], amount: -850 },
        { ...history[1], amount: -920 },
      ],
      company: { vatRegime: "REEL_NORMAL", vatExigibility: "DEBITS" },
      profile: tier3,
    }).status).toBe("AUTO_APPLIED");

    expect(policy.classifyAiSuggestion({
      suggestion: { ...suggestion, accountDebit: "671", ecritureLabel: "Charge exceptionnelle" },
      validation,
      transaction: { ...transaction, amount: -1200 },
      supplierHistory: [
        { ...history[0], accountDebit: "671", amount: -1100 },
        { ...history[1], accountDebit: "671", amount: -1150 },
      ],
      company: { vatRegime: "REEL_NORMAL", vatExigibility: "DEBITS" },
      profile: tier3,
    }).status).toBe("NEEDS_REVIEW");
  });
});

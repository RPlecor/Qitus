import { describe, expect, it } from "vitest";
import { AccountingCertaintyCenter } from "../app/modules/accounting-certainty/accounting-certainty-center.server";

describe("AccountingCertaintyCenter", () => {
  it("marks a deterministic transaction with valid accounts as verified", () => {
    const center = new AccountingCertaintyCenter(validation("VALIDATED") as never);
    const certainty = center.transactionCertaintyFromRecord(workspace(), transaction({
      confidence: "HIGH",
      source: "VENDOR_LOOKUP",
      status: "PROPOSED",
    }) as never);

    expect(certainty).toMatchObject({
      status: "verified",
      label: "Vérifié",
    });
    expect(certainty.reasons.map((reason) => reason.label)).toContain("Compte validé par le plan comptable Qitus");
    expect(certainty.reasons.map((reason) => reason.label)).toContain("Règle fournisseur appliquée");
  });

  it("marks an unconfirmed AI transaction as needs review", () => {
    const center = new AccountingCertaintyCenter(validation("VALIDATED") as never);
    const certainty = center.transactionCertaintyFromRecord(workspace(), transaction({
      confidence: "HIGH",
      source: "AI",
      status: "PROPOSED",
    }) as never);

    expect(certainty.status).toBe("needs_review");
    expect(certainty.reasons.map((reason) => reason.label)).toContain("Suggestion à confirmer");
  });

  it("marks an auto-applied AI transaction as verified by Qitus", () => {
    const center = new AccountingCertaintyCenter(validation("VALIDATED") as never);
    const certainty = center.transactionCertaintyFromRecord(workspace(), transaction({
      confidence: "HIGH",
      source: "AI",
      status: "AUTO_APPLIED",
    }) as never);

    expect(certainty.status).toBe("verified");
    expect(certainty.reasons.map((reason) => reason.label)).toContain("Appliqué automatiquement — corrigeable");
  });

  it("marks a light review AI transaction as quick review", () => {
    const center = new AccountingCertaintyCenter(validation("VALIDATED") as never);
    const certainty = center.transactionCertaintyFromRecord(workspace(), transaction({
      confidence: "HIGH",
      source: "AI",
      status: "REVIEW_LIGHT",
    }) as never);

    expect(certainty.status).toBe("review_light");
    expect(certainty.label).toBe("À relire rapidement");
  });

  it("blocks a transaction when the PCG validation fails", () => {
    const center = new AccountingCertaintyCenter(validation("BLOCKED") as never);
    const certainty = center.transactionCertaintyFromRecord(workspace(), transaction({
      confidence: "HIGH",
      source: "VENDOR_LOOKUP",
      status: "PROPOSED",
    }) as never);

    expect(certainty.status).toBe("blocked");
    expect(certainty.reasons[0]).toMatchObject({ label: "Compte absent du plan comptable Qitus", tone: "blocking" });
  });

  it("blocks an unbalanced journal entry", () => {
    const center = new AccountingCertaintyCenter(validation("VALIDATED") as never, chart() as never);
    const certainty = center.journalEntryCertaintyFromRecord(workspace(), {
      id: "je_1",
      lines: [
        { account: "5121", debit: "10", credit: "0" },
        { account: "706", debit: "0", credit: "9" },
      ],
      transactions: [],
    } as never);

    expect(certainty.status).toBe("blocked");
    expect(certainty.reasons.map((reason) => reason.label)).toContain("Écriture déséquilibrée");
  });
});

function workspace() {
  return { company: { vatRegime: "REEL_NORMAL" }, fiscalYear: { id: "fy_1" } } as never;
}

function validation(status: "VALIDATED" | "BLOCKED") {
  return {
    validateSuggestion() {
      return {
        status,
        valid: status === "VALIDATED",
        reviewRequired: status !== "VALIDATED",
        blockingReasons: status === "BLOCKED" ? ["Compte absent du plan comptable Qitus"] : [],
        warnings: [],
        chartVersion: "ANC-PCG-2026-01-01",
      };
    },
  };
}

function chart() {
  return {
    getActiveChartVersion() {
      return "ANC-PCG-2026-01-01";
    },
    getAccount(code: string) {
      return { code, label: code, isPostable: true };
    },
  };
}

function transaction(categorization: { confidence: string; source: string; status: string }) {
  return {
    id: "txn_1",
    amount: "-120.00",
    type: "DEBIT",
    label: "OVH",
    normalizedLabel: "ovh",
    counterparty: "OVH",
    categorization: {
      accountDebit: "6135",
      accountDebitLabel: "Cloud",
      accountCredit: "5121",
      accountCreditLabel: "Banque",
      journal: "BQ",
      ecritureLabel: "OVH",
      vatRate: null,
      vatOperationNature: null,
      confidence: categorization.confidence,
      source: categorization.source,
      status: categorization.status,
      isAnnualCharge: false,
      aiRationale: null,
    },
  };
}

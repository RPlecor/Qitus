import { describe, expect, it } from "vitest";
import { buildVatAwareLines, resolveVatTreatment, summarizeVatLines } from "../app/modules/ledger/vat-ledger-policy";

describe("VatLedgerPolicy", () => {
  it("keeps two lines for franchise companies", () => {
    const lines = buildVatAwareLines({
      transactionType: "DEBIT",
      amount: 120,
      vatRegime: "FRANCHISE",
      vatRate: 0.2,
      accountDebit: "6135",
      accountCredit: "5121",
    });

    expect(lines).toEqual([
      { account: "6135", accountLabel: undefined, debit: 120, credit: 0 },
      { account: "5121", accountLabel: undefined, debit: 0, credit: 120 },
    ]);
  });

  it("builds purchase lines with deductible VAT", () => {
    const lines = buildVatAwareLines({
      transactionType: "DEBIT",
      amount: 120,
      vatRegime: "REEL_SIMPLIFIE",
      vatRate: 0.2,
      accountDebit: "6135",
      accountDebitLabel: "SaaS",
      accountCredit: "5121",
      accountCreditLabel: "Banque",
    });

    expect(lines).toEqual([
      { account: "6135", accountLabel: "SaaS", debit: 100, credit: 0 },
      { account: "44566", accountLabel: "TVA déductible", debit: 20, credit: 0 },
      { account: "5121", accountLabel: "Banque", debit: 0, credit: 120 },
    ]);
  });

  it("builds sales lines with collected VAT", () => {
    const lines = buildVatAwareLines({
      transactionType: "CREDIT",
      amount: 1200,
      vatRegime: "REEL_NORMAL",
      vatRate: 0.2,
      accountDebit: "5121",
      accountDebitLabel: "Banque",
      accountCredit: "706",
      accountCreditLabel: "Prestations",
    });

    expect(lines).toEqual([
      { account: "5121", accountLabel: "Banque", debit: 1200, credit: 0 },
      { account: "706", accountLabel: "Prestations", debit: 0, credit: 1000 },
      { account: "44571", accountLabel: "TVA collectée", debit: 0, credit: 200 },
    ]);
  });

  it("explains missing VAT rate without applying VAT", () => {
    expect(resolveVatTreatment({ amount: 42, vatRegime: "REEL_NORMAL", vatRate: null })).toMatchObject({
      applies: false,
      reason: "missing_rate",
      amountTtc: 42,
    });
  });

  it("builds reverse-charge purchase lines with 44566 and 4452", () => {
    const lines = buildVatAwareLines({
      transactionType: "DEBIT",
      amount: 100,
      vatRegime: "REEL_NORMAL",
      vatRate: 0.2,
      vatOperationNature: "INTRACOM_PURCHASE",
      accountDebit: "6064",
      accountCredit: "5121",
    });

    expect(lines).toEqual([
      { account: "6064", accountLabel: undefined, debit: 100, credit: 0 },
      { account: "44566", accountLabel: "TVA déductible", debit: 20, credit: 0 },
      { account: "4452", accountLabel: "TVA due intracommunautaire / autoliquidation", debit: 0, credit: 20 },
      { account: "5121", accountLabel: undefined, debit: 0, credit: 100 },
    ]);
  });

  it("keeps exempt operations without VAT lines", () => {
    const lines = buildVatAwareLines({
      transactionType: "DEBIT",
      amount: 80,
      vatRegime: "REEL_NORMAL",
      vatRate: 0.2,
      vatOperationNature: "EXEMPT",
      accountDebit: "627",
      accountCredit: "5121",
    });

    expect(lines.map((line) => line.account)).toEqual(["627", "5121"]);
  });

  it("summarizes collected, deductible and reverse-charge VAT", () => {
    expect(summarizeVatLines([
      { account: "44571", debit: 0, credit: 200 },
      { account: "44566", debit: 80, credit: 0 },
      { account: "4452", debit: 0, credit: 20 },
    ])).toMatchObject({
      collected: 200,
      deductible: 80,
      reverseChargeDue: 20,
      net: 140,
    });
  });
});

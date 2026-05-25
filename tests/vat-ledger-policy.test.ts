import { beforeAll, describe, expect, it } from "vitest";
import { buildVatAwareLines, resolveVatTreatment, summarizeVatLines } from "../app/modules/ledger/vat-ledger-policy";
import { VatReferenceCenter } from "../app/modules/official-references/vat-reference-center.server";

describe("VatLedgerPolicy", () => {
  let vatReference: Awaited<ReturnType<VatReferenceCenter["getLedgerReference"]>>;

  beforeAll(async () => {
    vatReference = await new VatReferenceCenter().getLedgerReference();
  });

  it("keeps two lines for franchise companies", () => {
    const lines = buildVatAwareLines({
      transactionType: "DEBIT",
      amount: 120,
      vatRegime: "FRANCHISE",
      vatRate: 0.2,
      accountDebit: "6135",
      accountCredit: "5121",
    }, vatReference);

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
    }, vatReference);

    expect(lines).toEqual([
      { account: "6135", accountLabel: "SaaS", debit: 100, credit: 0 },
      { account: vatReference.accounts.deductible, accountLabel: vatReference.labels[vatReference.accounts.deductible], debit: 20, credit: 0 },
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
    }, vatReference);

    expect(lines).toEqual([
      { account: "5121", accountLabel: "Banque", debit: 1200, credit: 0 },
      { account: "706", accountLabel: "Prestations", debit: 0, credit: 1000 },
      { account: vatReference.accounts.collected, accountLabel: vatReference.labels[vatReference.accounts.collected], debit: 0, credit: 200 },
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
    }, vatReference);

    expect(lines).toEqual([
      { account: "6064", accountLabel: undefined, debit: 100, credit: 0 },
      { account: vatReference.accounts.deductible, accountLabel: vatReference.labels[vatReference.accounts.deductible], debit: 20, credit: 0 },
      { account: vatReference.accounts.reverseCharge, accountLabel: vatReference.labels[vatReference.accounts.reverseCharge], debit: 0, credit: 20 },
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
    }, vatReference);

    expect(lines.map((line) => line.account)).toEqual(["627", "5121"]);
  });

  it("summarizes collected, deductible and reverse-charge VAT", () => {
    expect(summarizeVatLines([
      { account: vatReference.accounts.collected, debit: 0, credit: 200 },
      { account: vatReference.accounts.deductible, debit: 80, credit: 0 },
      { account: vatReference.accounts.reverseCharge, debit: 0, credit: 20 },
    ], vatReference.accounts)).toMatchObject({
      collected: 200,
      deductible: 80,
      reverseChargeDue: 20,
      net: 140,
    });
  });
});

import Decimal from "decimal.js";
import type { VatOperationNature } from "@prisma/client";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";

export type VatRegimeLike = "FRANCHISE" | "REEL_SIMPLIFIE" | "REEL_NORMAL" | string;

export type VatLedgerLineInput = {
  transactionType: "DEBIT" | "CREDIT";
  amount: number;
  vatRegime: VatRegimeLike;
  vatRate?: number | null;
  vatOperationNature?: VatOperationNatureLike | null;
  accountDebit: string;
  accountDebitLabel?: string;
  accountCredit: string;
  accountCreditLabel?: string;
};

export type VatTreatment = {
  applies: boolean;
  vatRate: number | null;
  nature: VatOperationNatureLike;
  amountTtc: number;
  amountHt: number;
  vatAmount: number;
  reason: "franchise" | "missing_rate" | "zero_rate" | "exempt" | "out_of_scope" | "applied" | "reverse_charge";
};

export type VatOperationNatureLike = VatOperationNature | "DOMESTIC_PURCHASE" | "DOMESTIC_SALE" | "INTRACOM_PURCHASE" | "INTRACOM_SALE" | "REVERSE_CHARGE" | "EXEMPT" | "OUT_OF_SCOPE";

export class VatLedgerPolicy {
  resolveVatTreatment(company: { vatRegime: VatRegimeLike }, transaction: { amount: number; type?: "DEBIT" | "CREDIT" }, categorization: { vatRate?: number | string | null; vatOperationNature?: VatOperationNatureLike | null }): VatTreatment {
    const vatRate = categorization.vatRate === undefined || categorization.vatRate === null ? null : Number(categorization.vatRate);
    return resolveVatTreatment({ amount: transaction.amount, vatRegime: company.vatRegime, vatRate, transactionType: transaction.type ?? (transaction.amount >= 0 ? "CREDIT" : "DEBIT"), vatOperationNature: categorization.vatOperationNature });
  }

  buildVatAwareLines(input: VatLedgerLineInput) {
    return buildVatAwareLines(input);
  }

  async summarizeVatForFiscalYear(workspace: CompanyWorkspace) {
    const lines = await prisma.journalLine.findMany({
      where: { journalEntry: { fiscalYearId: workspace.fiscalYear.id }, account: { in: ["44566", "44571", "4452", "44551", "44567"] } },
      select: { account: true, debit: true, credit: true },
    });
    return summarizeVatLines(lines.map((line) => ({ account: line.account, debit: Number(line.debit), credit: Number(line.credit) })));
  }
}

export function resolveVatTreatment(input: Pick<VatLedgerLineInput, "amount" | "vatRegime" | "vatRate" | "vatOperationNature"> & { transactionType?: "DEBIT" | "CREDIT" }): VatTreatment {
  const amountTtc = money(new Decimal(input.amount).abs());
  const vatRate = input.vatRate === undefined || input.vatRate === null ? null : Number(input.vatRate);
  const nature = input.vatOperationNature ?? defaultNature(input.transactionType ?? (input.amount >= 0 ? "CREDIT" : "DEBIT"));
  if (input.vatRegime === "FRANCHISE") return { applies: false, vatRate, nature, amountTtc, amountHt: amountTtc, vatAmount: 0, reason: "franchise" };
  if (nature === "EXEMPT") return { applies: false, vatRate, nature, amountTtc, amountHt: amountTtc, vatAmount: 0, reason: "exempt" };
  if (nature === "OUT_OF_SCOPE" || nature === "INTRACOM_SALE") return { applies: false, vatRate, nature, amountTtc, amountHt: amountTtc, vatAmount: 0, reason: "out_of_scope" };
  if (vatRate === null || Number.isNaN(vatRate)) return { applies: false, vatRate: null, nature, amountTtc, amountHt: amountTtc, vatAmount: 0, reason: "missing_rate" };
  if (vatRate <= 0) return { applies: false, vatRate, nature, amountTtc, amountHt: amountTtc, vatAmount: 0, reason: "zero_rate" };

  if (nature === "INTRACOM_PURCHASE" || nature === "REVERSE_CHARGE") {
    const vatAmount = money(new Decimal(amountTtc).mul(vatRate));
    return { applies: true, vatRate, nature, amountTtc, amountHt: amountTtc, vatAmount, reason: "reverse_charge" };
  }

  const ht = money(new Decimal(amountTtc).div(new Decimal(1).plus(vatRate)));
  const vatAmount = money(new Decimal(amountTtc).minus(ht));
  return { applies: true, vatRate, nature, amountTtc, amountHt: ht, vatAmount, reason: "applied" };
}

export function buildVatAwareLines(input: VatLedgerLineInput): Array<{ account: string; accountLabel?: string; debit: number; credit: number }> {
  const treatment = resolveVatTreatment(input);
  if (!treatment.applies) {
    return [
      { account: input.accountDebit, accountLabel: input.accountDebitLabel, debit: treatment.amountTtc, credit: 0 },
      { account: input.accountCredit, accountLabel: input.accountCreditLabel, debit: 0, credit: treatment.amountTtc },
    ];
  }

  if (treatment.reason === "reverse_charge") {
    return [
      { account: input.accountDebit, accountLabel: input.accountDebitLabel, debit: treatment.amountHt, credit: 0 },
      { account: "44566", accountLabel: "TVA déductible", debit: treatment.vatAmount, credit: 0 },
      { account: "4452", accountLabel: "TVA due intracommunautaire / autoliquidation", debit: 0, credit: treatment.vatAmount },
      { account: input.accountCredit, accountLabel: input.accountCreditLabel, debit: 0, credit: treatment.amountHt },
    ];
  }

  if (input.transactionType === "CREDIT") {
    return [
      { account: input.accountDebit, accountLabel: input.accountDebitLabel, debit: treatment.amountTtc, credit: 0 },
      { account: input.accountCredit, accountLabel: input.accountCreditLabel, debit: 0, credit: treatment.amountHt },
      { account: "44571", accountLabel: "TVA collectée", debit: 0, credit: treatment.vatAmount },
    ];
  }

  return [
    { account: input.accountDebit, accountLabel: input.accountDebitLabel, debit: treatment.amountHt, credit: 0 },
    { account: "44566", accountLabel: "TVA déductible", debit: treatment.vatAmount, credit: 0 },
    { account: input.accountCredit, accountLabel: input.accountCreditLabel, debit: 0, credit: treatment.amountTtc },
  ];
}

export function summarizeVatLines(lines: Array<{ account: string; debit: number; credit: number }>) {
  const summary = lines.reduce(
    (summary, line) => {
      if (line.account === "44566") summary.deductible += line.debit - line.credit;
      if (line.account === "44571") summary.collected += line.credit - line.debit;
      if (line.account === "4452") summary.reverseChargeDue += line.credit - line.debit;
      if (line.account === "44551") summary.toPay += line.credit - line.debit;
      if (line.account === "44567") summary.credit += line.debit - line.credit;
      return summary;
    },
    { deductible: 0, collected: 0, reverseChargeDue: 0, toPay: 0, credit: 0, net: 0 }
  );
  summary.net = money(new Decimal(summary.collected).plus(summary.reverseChargeDue).minus(summary.deductible));
  return summary;
}

export function defaultNature(transactionType: "DEBIT" | "CREDIT"): VatOperationNatureLike {
  return transactionType === "CREDIT" ? "DOMESTIC_SALE" : "DOMESTIC_PURCHASE";
}

function money(value: Decimal) {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

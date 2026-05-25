import Decimal from "decimal.js";
import type { VatOperationNature } from "@prisma/client";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { VatReferenceCenter } from "../official-references/vat-reference-center.server";
import type { VatReferencePayload } from "../official-references/official-reference-data.server";

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

export type VatLedgerReference = {
  accounts: VatReferencePayload["accounts"];
  labels: Record<string, string>;
};

export class VatLedgerPolicy {
  private readonly vatReference = new VatReferenceCenter();

  resolveVatTreatment(company: { vatRegime: VatRegimeLike }, transaction: { amount: number; type?: "DEBIT" | "CREDIT" }, categorization: { vatRate?: number | string | null; vatOperationNature?: VatOperationNatureLike | null }): VatTreatment {
    const vatRate = categorization.vatRate === undefined || categorization.vatRate === null ? null : Number(categorization.vatRate);
    return resolveVatTreatment({ amount: transaction.amount, vatRegime: company.vatRegime, vatRate, transactionType: transaction.type ?? (transaction.amount >= 0 ? "CREDIT" : "DEBIT"), vatOperationNature: categorization.vatOperationNature });
  }

  buildVatAwareLines(input: VatLedgerLineInput) {
    throw new Error("Référentiel TVA requis : utilisez buildVatAwareLines avec une référence TVA active.");
  }

  async summarizeVatForFiscalYear(workspace: CompanyWorkspace) {
    const vatAccounts = Object.values(await this.vatReference.getVatAccounts());
    const lines = await prisma.journalLine.findMany({
      where: { journalEntry: { fiscalYearId: workspace.fiscalYear.id }, account: { in: vatAccounts } },
      select: { account: true, debit: true, credit: true },
    });
    return summarizeVatLines(lines.map((line) => ({ account: line.account, debit: Number(line.debit), credit: Number(line.credit) })), (await this.vatReference.getLedgerReference()).accounts);
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

export function buildVatAwareLines(input: VatLedgerLineInput, reference: VatLedgerReference): Array<{ account: string; accountLabel?: string; debit: number; credit: number }> {
  const treatment = resolveVatTreatment(input);
  const { accounts, labels } = reference;
  if (!treatment.applies) {
    return [
      { account: input.accountDebit, accountLabel: input.accountDebitLabel, debit: treatment.amountTtc, credit: 0 },
      { account: input.accountCredit, accountLabel: input.accountCreditLabel, debit: 0, credit: treatment.amountTtc },
    ];
  }

  if (treatment.reason === "reverse_charge") {
    return [
      { account: input.accountDebit, accountLabel: input.accountDebitLabel, debit: treatment.amountHt, credit: 0 },
      { account: accounts.deductible, accountLabel: labels[accounts.deductible], debit: treatment.vatAmount, credit: 0 },
      { account: accounts.reverseCharge, accountLabel: labels[accounts.reverseCharge], debit: 0, credit: treatment.vatAmount },
      { account: input.accountCredit, accountLabel: input.accountCreditLabel, debit: 0, credit: treatment.amountHt },
    ];
  }

  if (input.transactionType === "CREDIT") {
    return [
      { account: input.accountDebit, accountLabel: input.accountDebitLabel, debit: treatment.amountTtc, credit: 0 },
      { account: input.accountCredit, accountLabel: input.accountCreditLabel, debit: 0, credit: treatment.amountHt },
      { account: accounts.collected, accountLabel: labels[accounts.collected], debit: 0, credit: treatment.vatAmount },
    ];
  }

  return [
    { account: input.accountDebit, accountLabel: input.accountDebitLabel, debit: treatment.amountHt, credit: 0 },
    { account: accounts.deductible, accountLabel: labels[accounts.deductible], debit: treatment.vatAmount, credit: 0 },
    { account: input.accountCredit, accountLabel: input.accountCreditLabel, debit: 0, credit: treatment.amountTtc },
  ];
}

export function summarizeVatLines(lines: Array<{ account: string; debit: number; credit: number }>, accounts: VatReferencePayload["accounts"]) {
  const summary = lines.reduce(
    (summary, line) => {
      if (line.account === accounts.deductible) summary.deductible += line.debit - line.credit;
      if (line.account === accounts.collected) summary.collected += line.credit - line.debit;
      if (line.account === accounts.reverseCharge) summary.reverseChargeDue += line.credit - line.debit;
      if (line.account === accounts.payable) summary.toPay += line.credit - line.debit;
      if (line.account === accounts.credit) summary.credit += line.debit - line.credit;
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

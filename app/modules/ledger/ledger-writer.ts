import Decimal from "decimal.js";
import type { EntrySource } from "@prisma/client";
import type { CategorizationSuggestion, CategorizationTransaction } from "../categorization/types";
import { buildVatAwareLines, type VatLedgerReference, type VatRegimeLike } from "./vat-ledger-policy";

export type JournalEntryDraft = {
  num: number;
  date: string;
  journal: string;
  ref?: string;
  label: string;
  source: EntrySource | "IMPORT";
  transactionId: string;
  lines: Array<{ account: string; accountLabel?: string; debit: number; credit: number }>;
};

export function writeJournalEntries(input: {
  transactions: CategorizationTransaction[];
  categorizations: CategorizationSuggestion[];
  startingNum?: number;
  company?: { vatRegime: VatRegimeLike };
  vatReference: VatLedgerReference;
}): JournalEntryDraft[] {
  const byTransaction = new Map(input.categorizations.map((categorization) => [categorization.transactionId, categorization]));
  let nextNum = input.startingNum ?? 1;

  return input.transactions.flatMap((transaction) => {
    const categorization = byTransaction.get(transaction.id);
    if (!categorization || categorization.confidence === "LOW") return [];

    const amount = new Decimal(transaction.amount).abs().toDecimalPlaces(2).toNumber();
    const entry: JournalEntryDraft = {
      num: nextNum++,
      date: transaction.date,
      journal: categorization.journal,
      ref: transaction.sourceRef ?? transaction.sourceId,
      label: categorization.ecritureLabel,
      source: "IMPORT",
      transactionId: transaction.id,
      lines: buildVatAwareLines(
        {
          transactionType: transaction.type,
          amount,
          vatRegime: input.company?.vatRegime ?? "FRANCHISE",
          vatRate: categorization.vatRate,
          vatOperationNature: categorization.vatOperationNature as never,
          accountDebit: categorization.accountDebit,
          accountDebitLabel: categorization.accountDebitLabel,
          accountCredit: categorization.accountCredit,
          accountCreditLabel: categorization.accountCreditLabel,
        },
        input.vatReference,
      ),
    };

    assertBalanced(entry);
    return [entry];
  });
}

function assertBalanced(entry: JournalEntryDraft) {
  const debit = entry.lines.reduce((sum, line) => sum.plus(line.debit), new Decimal(0));
  const credit = entry.lines.reduce((sum, line) => sum.plus(line.credit), new Decimal(0));
  if (!debit.equals(credit)) {
    throw new Error(`Journal entry ${entry.num} is not balanced`);
  }
}

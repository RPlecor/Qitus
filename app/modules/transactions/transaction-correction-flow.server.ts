import type { VatOperationNature } from "@prisma/client";
import { prisma } from "../db.server";
import { AccountingReferencePolicyCenter } from "../accounting-reference/accounting-reference-policy-center.server";
import { AccountingAssignmentValidationPolicy } from "../accounting-reference/accounting-assignment-validation-policy.server";
import { CategorizationTrustPolicy } from "../accounting-reference/categorization-trust-policy.server";
import { writeJournalEntries } from "../ledger/ledger-writer";
import { VatReferenceCenter } from "../official-references/vat-reference-center.server";
import { ExpectedRouteError } from "../route-errors.server";
import type { CategorizationSuggestion, CategorizationTransaction } from "../categorization/types";
import { parseVatOperationNature as parseVatNaturePolicy, parseVatRate as parseVatRatePolicy } from "../vat/vat-rate-policy";

export type TransactionReview = {
  id: string;
  label: string;
  amount: string;
  status: string | null;
  confidence: string | null;
  accountDebit: string;
  accountDebitLabel: string | null;
  accountCredit: string;
  accountCreditLabel: string | null;
  vatRate: string | null;
  vatOperationNature: string | null;
  ecritureLabel: string;
  rationale: string | null;
};

export class TransactionCorrectionFlow {
  async getTransactionReview(transactionId: string): Promise<TransactionReview> {
    const transaction = await prisma.transaction.findUniqueOrThrow({
      where: { id: transactionId },
      include: { categorization: true },
    });
    const [suspenseRole, bankRole] = transaction.categorization
      ? [null, null]
      : await Promise.all([
        new AccountingReferencePolicyCenter().getAccountRole("suspense"),
        new AccountingReferencePolicyCenter().getAccountRole("bank"),
      ]);

    return {
      id: transaction.id,
      label: transaction.label,
      amount: transaction.amount.toString(),
      status: transaction.categorization?.status ?? null,
      confidence: transaction.categorization?.confidence ?? null,
      accountDebit: transaction.categorization?.accountDebit ?? suspenseRole?.account ?? "",
      accountDebitLabel: transaction.categorization?.accountDebitLabel ?? null,
      accountCredit: transaction.categorization?.accountCredit ?? bankRole?.account ?? "",
      accountCreditLabel: transaction.categorization?.accountCreditLabel ?? null,
      vatRate: transaction.categorization?.vatRate?.toString() ?? null,
      vatOperationNature: transaction.categorization?.vatOperationNature ?? null,
      ecritureLabel: transaction.categorization?.ecritureLabel ?? transaction.label,
      rationale: transaction.categorization?.aiRationale ?? null,
    };
  }

  async confirmCategorization(input: {
    transactionId: string;
    accountDebit: string;
    accountCredit: string;
    vatRate?: string | null;
    vatOperationNature?: string | null;
    ecritureLabel: string;
    learn: boolean;
  }) {
    const vatReference = await new VatReferenceCenter().getLedgerReference();
    return prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUniqueOrThrow({
        where: { id: input.transactionId },
        include: { fiscalYear: { include: { company: true } }, categorization: true },
      });

      const accountDebitLabel = await accountLabel(input.accountDebit, transaction.categorization?.accountDebitLabel ?? null);
      const accountCreditLabel = await accountLabel(input.accountCredit, transaction.categorization?.accountCreditLabel ?? null);
      const vatRate = parseVatRate(input.vatRate);
      const vatOperationNature = parseVatOperationNature(input.vatOperationNature);
      const validationPolicy = new AccountingAssignmentValidationPolicy();
      const trustPolicy = new CategorizationTrustPolicy();
      const suggestion = toCategorizationSuggestion(transaction.id, input, accountDebitLabel, accountCreditLabel);
      const validation = validationPolicy.validateSuggestion(transaction.fiscalYear.company, suggestion, toCategorizationTransaction(transaction));
      const trust = trustPolicy.classifySuggestion(suggestion, validation);
      if (!validation.valid || !trust.writable) {
        throw new ExpectedRouteError([...validation.blockingReasons, ...trust.reasons].filter(Boolean)[0] ?? "Catégorisation à vérifier avant création de l'écriture.", 400);
      }
      const correctedExisting = transaction.categorization
        ? transaction.categorization.accountDebit !== input.accountDebit
          || transaction.categorization.accountCredit !== input.accountCredit
          || (transaction.categorization.vatRate?.toString() ?? null) !== (vatRate === null ? null : String(vatRate))
          || (transaction.categorization.vatOperationNature ?? null) !== vatOperationNature
          || transaction.categorization.ecritureLabel !== input.ecritureLabel
        : false;
      const correctedAutoApplied = correctedExisting && transaction.categorization?.status === "AUTO_APPLIED";
      const userStatus = correctedExisting ? "USER_CORRECTED" : "USER_CONFIRMED";
      const categorization = await tx.categorization.upsert({
        where: { transactionId: transaction.id },
        update: {
          originalAccountDebit: correctedExisting ? transaction.categorization?.accountDebit : transaction.categorization?.originalAccountDebit,
          originalAccountCredit: correctedExisting ? transaction.categorization?.accountCredit : transaction.categorization?.originalAccountCredit,
          accountDebit: input.accountDebit,
          accountDebitLabel,
          accountCredit: input.accountCredit,
          accountCreditLabel,
          vatRate,
          vatOperationNature,
          journal: "BQ",
          ecritureLabel: input.ecritureLabel,
          confidence: "HIGH",
          source: "MANUAL",
          status: userStatus,
          chartVersion: validation.chartVersion,
          validationStatus: "VALIDATED",
          validationReasonsJson: { blockingReasons: validation.blockingReasons, warnings: validation.warnings, trustReasons: trust.reasons },
          validatedAt: new Date(),
          confirmedAt: new Date(),
        },
        create: {
          fiscalYearId: transaction.fiscalYearId,
          transactionId: transaction.id,
          accountDebit: input.accountDebit,
          accountDebitLabel,
          accountCredit: input.accountCredit,
          accountCreditLabel,
          vatRate,
          vatOperationNature,
          journal: "BQ",
          ecritureLabel: input.ecritureLabel,
          confidence: "HIGH",
          source: "MANUAL",
          status: userStatus,
          chartVersion: validation.chartVersion,
          validationStatus: "VALIDATED",
          validationReasonsJson: { blockingReasons: validation.blockingReasons, warnings: validation.warnings, trustReasons: trust.reasons },
          validatedAt: new Date(),
          confirmedAt: new Date(),
        },
      });

      if (correctedAutoApplied) {
        await tx.activityLog.create({
          data: {
            companyId: transaction.fiscalYear.companyId,
            fiscalYearId: transaction.fiscalYearId,
            userId: transaction.fiscalYear.company.userId,
            action: "transaction.user_corrected_auto_applied",
            entityType: "transaction",
            entityId: transaction.id,
            metadata: {
              previousAccountDebit: transaction.categorization?.accountDebit,
              previousAccountCredit: transaction.categorization?.accountCredit,
              correctedAccountDebit: input.accountDebit,
              correctedAccountCredit: input.accountCredit,
            },
          },
        });
      }

      const existingJournalEntry = transaction.journalEntryId
        ? await tx.journalEntry.findUnique({ where: { id: transaction.journalEntryId } })
        : null;
      const maxEntry = existingJournalEntry ? null : await tx.journalEntry.findFirst({
        where: { fiscalYearId: transaction.fiscalYearId },
        orderBy: { num: "desc" },
      });
      const [draft] = writeJournalEntries({
        transactions: [toCategorizationTransaction(transaction)],
        categorizations: [suggestion],
        startingNum: existingJournalEntry?.num ?? (maxEntry?.num ?? 0) + 1,
        company: { vatRegime: transaction.fiscalYear.company.vatRegime },
        vatReference,
      });
      if (!draft) return { categorization, journalEntryCreated: false };

      if (existingJournalEntry) {
        await tx.journalEntry.update({
          where: { id: existingJournalEntry.id },
          data: {
            label: draft.label,
            journal: draft.journal,
            ref: draft.ref,
            lines: {
              deleteMany: {},
              create: draft.lines.map((line) => ({
                account: line.account,
                accountLabel: line.accountLabel,
                debit: line.debit,
                credit: line.credit,
              })),
            },
          },
        });
        return { categorization, journalEntryCreated: false, journalEntryUpdated: true };
      }

      await tx.journalEntry.create({
        data: {
          fiscalYearId: transaction.fiscalYearId,
          num: draft.num,
          date: new Date(draft.date),
          journal: draft.journal,
          ref: draft.ref,
          label: draft.label,
          source: "IMPORT",
          transactions: { connect: { id: transaction.id } },
          lines: {
            create: draft.lines.map((line) => ({
              account: line.account,
              accountLabel: line.accountLabel,
              debit: line.debit,
              credit: line.credit,
            })),
          },
        },
      });

      return { categorization, journalEntryCreated: true, journalEntryUpdated: false };
    });
  }
}

function toCategorizationTransaction(transaction: {
  id: string;
  sourceId: string | null;
  date: Date;
  label: string;
  normalizedLabel: string;
  counterparty: string | null;
  amount: unknown;
  currency: string;
  type: "DEBIT" | "CREDIT";
  sourceRef: string | null;
  sourceCategory: string | null;
  notes: string | null;
}): CategorizationTransaction {
  return {
    id: transaction.id,
    sourceId: transaction.sourceId ?? undefined,
    date: transaction.date.toISOString().slice(0, 10),
    label: transaction.label,
    normalizedLabel: transaction.normalizedLabel,
    counterparty: transaction.counterparty ?? undefined,
    amount: Number(transaction.amount),
    currency: transaction.currency,
    type: transaction.type,
    sourceRef: transaction.sourceRef ?? undefined,
    sourceCategory: transaction.sourceCategory ?? undefined,
    notes: transaction.notes ?? undefined,
  };
}

function toCategorizationSuggestion(
  transactionId: string,
  input: { accountDebit: string; accountCredit: string; ecritureLabel: string; vatRate?: string | null; vatOperationNature?: string | null },
  accountDebitLabel: string | null,
  accountCreditLabel: string | null
): CategorizationSuggestion {
  return {
    transactionId,
    accountDebit: input.accountDebit,
    accountDebitLabel: accountDebitLabel ?? undefined,
    accountCredit: input.accountCredit,
    accountCreditLabel: accountCreditLabel ?? undefined,
    journal: "BQ",
    ecritureLabel: input.ecritureLabel,
    vatRate: parseVatRate(input.vatRate),
    vatOperationNature: parseVatOperationNature(input.vatOperationNature),
    confidence: "HIGH",
    source: "MANUAL",
  };
}

function parseVatOperationNature(value: string | null | undefined): VatOperationNature | null {
  return parseVatNaturePolicy(value) as VatOperationNature | null;
}

function parseVatRate(value: string | null | undefined) {
  return parseVatRatePolicy(value);
}

async function accountLabel(account: string, fallback: string | null) {
  if (fallback) return fallback;
  const policy = new AccountingReferencePolicyCenter();
  const [bank, suspense] = await Promise.all([
    policy.getAccountRole("bank"),
    policy.getAccountRole("suspense"),
  ]);
  if (account === bank.account) return bank.label;
  if (account === suspense.account) return suspense.label;
  return null;
}

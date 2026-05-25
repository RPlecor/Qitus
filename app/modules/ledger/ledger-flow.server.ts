import { prisma } from "../db.server";
import { AccountingAssignmentValidationPolicy } from "../accounting-reference/accounting-assignment-validation-policy.server";
import { CategorizationTrustPolicy } from "../accounting-reference/categorization-trust-policy.server";
import { VatReferenceCenter } from "../official-references/vat-reference-center.server";
import { writeJournalEntries } from "./ledger-writer";

export async function writeEntriesForImport(importId: string) {
  const importRow = await prisma.import.findUniqueOrThrow({
    where: { id: importId },
    include: { fiscalYear: { include: { company: true } }, transactions: { include: { categorization: true } } },
  });

  const maxEntry = await prisma.journalEntry.findFirst({
    where: { fiscalYearId: importRow.fiscalYearId },
    orderBy: { num: "desc" },
  });

  const eligibleTransactions = importRow.transactions.filter((transaction) => !transaction.journalEntryId);
  const validationPolicy = new AccountingAssignmentValidationPolicy();
  const trustPolicy = new CategorizationTrustPolicy();
  const transactions = eligibleTransactions.map((transaction) => ({
    id: transaction.id,
    date: transaction.date.toISOString().slice(0, 10),
    label: transaction.label,
    normalizedLabel: transaction.normalizedLabel,
    counterparty: transaction.counterparty ?? undefined,
    amount: Number(transaction.amount),
    currency: transaction.currency,
    type: transaction.type,
    sourceId: transaction.sourceId ?? undefined,
    sourceRef: transaction.sourceRef ?? undefined,
    sourceCategory: transaction.sourceCategory ?? undefined,
  }));

  const categorizations = eligibleTransactions.flatMap((transaction) => {
    const categorization = transaction.categorization;
    if (!categorization || categorization.status === "NEEDS_REVIEW" || categorization.status === "REVIEW_LIGHT" || !categorization.accountDebit || !categorization.accountCredit || !categorization.journal || !categorization.ecritureLabel) return [];
    if (categorization.validationStatus !== "VALIDATED") return [];
    const suggestion = {
      transactionId: transaction.id,
      accountDebit: categorization.accountDebit,
      accountDebitLabel: categorization.accountDebitLabel ?? undefined,
      accountCredit: categorization.accountCredit,
      accountCreditLabel: categorization.accountCreditLabel ?? undefined,
      journal: categorization.journal,
      ecritureLabel: categorization.ecritureLabel,
      vatRate: categorization.vatRate === null ? null : Number(categorization.vatRate),
      vatOperationNature: categorization.vatOperationNature,
      confidence: categorization.confidence,
      source: categorization.source,
    };
    const validation = validationPolicy.validateSuggestion(importRow.fiscalYear.company, suggestion, {
      amount: Number(transaction.amount),
      type: transaction.type,
    });
    const trust = trustPolicy.classifySuggestion(suggestion, validation, { storedStatus: categorization.status });
    return validation.status === "VALIDATED" && trust.writable ? [suggestion] : [];
  });

  const vatReference = await new VatReferenceCenter().getLedgerReference();
  const drafts = writeJournalEntries({ transactions, categorizations, startingNum: (maxEntry?.num ?? 0) + 1, company: { vatRegime: importRow.fiscalYear.company.vatRegime }, vatReference });
  for (const draft of drafts) {
    await prisma.journalEntry.create({
      data: {
        fiscalYearId: importRow.fiscalYearId,
        num: draft.num,
        date: new Date(draft.date),
        journal: draft.journal,
        ref: draft.ref,
        label: draft.label,
        source: "IMPORT",
        transactions: { connect: { id: draft.transactionId } },
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
  }

  return drafts;
}

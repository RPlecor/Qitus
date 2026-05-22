import { CategorizationStatus, Confidence } from "@prisma/client";
import { getPeriodKey } from "../billing/usage-meter.server";
import { prisma } from "../db.server";
import { normalizeLabel } from "../import-pipeline/parsers";
import { CategorizationEngine } from "./categorization-engine";
import { createAiCategorizationProvider } from "./provider-factory.server";
import type { CategorizationSuggestion } from "./types";

export async function categorizeImport(importId: string) {
  const importRow = await prisma.import.findUniqueOrThrow({
    where: { id: importId },
    include: { fiscalYear: { include: { company: true } }, transactions: true },
  });
  const company = importRow.fiscalYear.company;
  const correctionRules = await prisma.correctionRule.findMany({ where: { fiscalYearId: importRow.fiscalYearId, active: true } });
  const vendorMappings = await prisma.vendorMapping.findMany({
    where: { active: true, OR: [{ companyId: null }, { companyId: company.id }] },
  });

  const engine = new CategorizationEngine(createAiCategorizationProvider());
  const lockedCategorizations = new Set(
    await prisma.categorization.findMany({
      where: {
        transactionId: { in: importRow.transactions.map((transaction) => transaction.id) },
        status: { in: ["USER_CONFIRMED", "USER_CORRECTED", "MANUAL"] },
      },
      select: { transactionId: true },
    }).then((rows) => rows.map((row) => row.transactionId))
  );
  const suggestions = await engine.categorize(
    importRow.transactions.map((transaction) => ({
      id: transaction.id,
      sourceId: transaction.sourceId ?? undefined,
      date: transaction.date.toISOString().slice(0, 10),
      label: transaction.label,
      normalizedLabel: transaction.normalizedLabel || normalizeLabel(transaction.label),
      counterparty: transaction.counterparty ?? undefined,
      amount: Number(transaction.amount),
      currency: transaction.currency,
      type: transaction.type,
      sourceRef: transaction.sourceRef ?? undefined,
      sourceCategory: transaction.sourceCategory ?? undefined,
      notes: transaction.notes ?? undefined,
    })),
    {
      companyName: company.name,
      legalForm: company.legalForm,
      vatRegime: company.vatRegime,
      correctionRules: correctionRules.map((rule) => ({
        counterparty: rule.counterparty,
        preferredAccount: rule.preferredAccount,
        preferredAccountLabel: rule.preferredAccountLabel ?? undefined,
        preferredVatRate: rule.preferredVatRate === null ? null : Number(rule.preferredVatRate),
        vatOperationNature: rule.vatOperationNature,
      })),
      vendorMappings: vendorMappings.map((mapping) => ({
        pattern: mapping.pattern,
        matchType: mapping.matchType,
        accountDebit: mapping.accountDebit,
        accountLabel: mapping.accountLabel ?? undefined,
        accountCredit: mapping.accountCredit,
        journal: mapping.journal,
        ecritureLabel: mapping.ecritureLabel ?? undefined,
        vatRate: mapping.vatRate === null ? null : Number(mapping.vatRate),
        vatOperationNature: mapping.vatOperationNature,
        isAnnualCharge: mapping.isAnnualCharge,
      })),
    }
  );

  for (const suggestion of suggestions) {
    if (lockedCategorizations.has(suggestion.transactionId)) continue;
    const transaction = importRow.transactions.find((candidate) => candidate.id === suggestion.transactionId);
    await upsertCategorization(importRow.fiscalYearId, suggestion, transaction?.normalizedLabel ?? normalizeLabel(transaction?.label ?? ""));
  }
  await recordAiCategorizationUsage(importRow.fiscalYearId, company.id, company.userId, suggestions.filter((suggestion) => suggestion.source === "AI").length);

  const rows = await prisma.categorization.findMany({
    where: { transaction: { importId } },
    select: { status: true },
  });
  const reviewRows = rows.filter((row) => row.status === "NEEDS_REVIEW").length;
  await prisma.import.update({
    where: { id: importId },
    data: {
      status: reviewRows > 0 ? "REVIEW" : "DONE",
      categorizedRows: rows.length,
      reviewRows,
      completedAt: new Date(),
    },
  });

  return { suggestions, reviewRows };
}

async function recordAiCategorizationUsage(fiscalYearId: string, companyId: string, userId: string | null, quantity: number) {
  if (quantity <= 0) return;
  await prisma.usageEvent.create({
    data: {
      companyId,
      fiscalYearId,
      userId,
      kind: "AI_CATEGORIZATION",
      quantity,
      periodKey: getPeriodKey(),
      metadataJson: { source: "categorization-flow" },
    },
  });
}

async function upsertCategorization(fiscalYearId: string, suggestion: CategorizationSuggestion, normalizedLabel: string) {
  const status = needsReview(suggestion, normalizedLabel) ? CategorizationStatus.NEEDS_REVIEW : CategorizationStatus.PROPOSED;
  return prisma.categorization.upsert({
    where: { transactionId: suggestion.transactionId },
    update: {
      accountDebit: suggestion.accountDebit,
      accountDebitLabel: suggestion.accountDebitLabel,
      accountCredit: suggestion.accountCredit,
      accountCreditLabel: suggestion.accountCreditLabel,
      journal: suggestion.journal,
      ecritureLabel: suggestion.ecritureLabel,
      vatRate: suggestion.vatRate,
      vatOperationNature: suggestion.vatOperationNature as never,
      confidence: suggestion.confidence as Confidence,
      source: suggestion.source,
      aiRationale: suggestion.rationale,
      alternatives: suggestion.alternatives ?? undefined,
      isAnnualCharge: suggestion.isAnnualCharge ?? false,
      status,
    },
    create: {
      fiscalYearId,
      transactionId: suggestion.transactionId,
      accountDebit: suggestion.accountDebit,
      accountDebitLabel: suggestion.accountDebitLabel,
      accountCredit: suggestion.accountCredit,
      accountCreditLabel: suggestion.accountCreditLabel,
      journal: suggestion.journal,
      ecritureLabel: suggestion.ecritureLabel,
      vatRate: suggestion.vatRate,
      vatOperationNature: suggestion.vatOperationNature as never,
      confidence: suggestion.confidence as Confidence,
      source: suggestion.source,
      aiRationale: suggestion.rationale,
      alternatives: suggestion.alternatives ?? undefined,
      isAnnualCharge: suggestion.isAnnualCharge ?? false,
      status,
    },
  });
}

function needsReview(suggestion: CategorizationSuggestion, normalizedLabel: string) {
  if (suggestion.confidence === "LOW") return true;
  if (suggestion.source === "AI" && suggestion.confidence === "MEDIUM") return true;
  return suggestion.source === "AI" && normalizedLabel.includes("depot comptes annuels");
}

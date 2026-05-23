import { CategorizationStatus, Confidence } from "@prisma/client";
import { getPeriodKey } from "../billing/usage-meter.server";
import { prisma } from "../db.server";
import { normalizeLabel } from "../import-pipeline/parsers";
import { AccountingAssignmentValidationPolicy, type AccountingAssignmentValidationResult } from "../accounting-reference/accounting-assignment-validation-policy.server";
import { CategorizationTrustPolicy, type CategorizationTrustDecision } from "../accounting-reference/categorization-trust-policy.server";
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
  const activeRulePack = await prisma.accountingRulePack.findFirst({ where: { status: "ACTIVE" }, orderBy: { activatedAt: "desc" } });

  const engine = new CategorizationEngine(createAiCategorizationProvider());
  const validationPolicy = new AccountingAssignmentValidationPolicy();
  const trustPolicy = new CategorizationTrustPolicy();
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
    const normalizedLabel = transaction?.normalizedLabel ?? normalizeLabel(transaction?.label ?? "");
    const transactionInput = transaction ? {
      id: transaction.id,
      sourceId: transaction.sourceId ?? undefined,
      date: transaction.date.toISOString().slice(0, 10),
      label: transaction.label,
      normalizedLabel,
      counterparty: transaction.counterparty ?? undefined,
      amount: Number(transaction.amount),
      currency: transaction.currency,
      type: transaction.type,
      sourceRef: transaction.sourceRef ?? undefined,
      sourceCategory: transaction.sourceCategory ?? undefined,
      notes: transaction.notes ?? undefined,
    } : undefined;
    const accounting = validateSuggestionForStorage(company, suggestion, transactionInput, validationPolicy, trustPolicy);
    await upsertCategorization(importRow.fiscalYearId, accounting.suggestion, normalizedLabel, accounting.validation, accounting.trust, activeRulePack?.id ?? null);
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

function validateSuggestionForStorage(
  company: { vatRegime: string },
  suggestion: CategorizationSuggestion,
  transaction: Parameters<AccountingAssignmentValidationPolicy["validateSuggestion"]>[2],
  validationPolicy: AccountingAssignmentValidationPolicy,
  trustPolicy: CategorizationTrustPolicy
) {
  let suggestionToStore = suggestion;
  let validation = validationPolicy.validateSuggestion(company, suggestionToStore, transaction);
  const hasUnknownAccount = validation.blockingReasons.some((reason) => reason.includes("non reconnu"));
  if (suggestion.source === "AI" && hasUnknownAccount) {
    suggestionToStore = {
      ...suggestion,
      accountDebit: transaction?.type === "CREDIT" ? "5121" : "471",
      accountDebitLabel: transaction?.type === "CREDIT" ? "Banque" : "Compte d'attente",
      accountCredit: transaction?.type === "CREDIT" ? "471" : "5121",
      accountCreditLabel: transaction?.type === "CREDIT" ? "Compte d'attente" : "Banque",
      confidence: "LOW",
      rationale: appendReason(suggestion.rationale, "Compte proposé non reconnu par Qitus."),
    };
    validation = validationPolicy.validateSuggestion(company, suggestionToStore, transaction);
  }
  return {
    suggestion: suggestionToStore,
    validation,
    trust: trustPolicy.classifySuggestion(suggestionToStore, validation),
  };
}

async function upsertCategorization(
  fiscalYearId: string,
  suggestion: CategorizationSuggestion,
  normalizedLabel: string,
  validation: AccountingAssignmentValidationResult,
  trust: CategorizationTrustDecision,
  rulePackId: string | null
) {
  const status = needsReview(suggestion, normalizedLabel, validation, trust) ? CategorizationStatus.NEEDS_REVIEW : CategorizationStatus.PROPOSED;
  const validationReasonsJson = {
    blockingReasons: validation.blockingReasons,
    warnings: validation.warnings,
    trustReasons: trust.reasons,
  };
  return prisma.categorization.upsert({
    where: { transactionId: suggestion.transactionId },
    update: {
      accountDebit: suggestion.accountDebit,
      accountDebitLabel: validation.accountDebitLabel ?? suggestion.accountDebitLabel,
      accountCredit: suggestion.accountCredit,
      accountCreditLabel: validation.accountCreditLabel ?? suggestion.accountCreditLabel,
      journal: suggestion.journal,
      ecritureLabel: suggestion.ecritureLabel,
      vatRate: suggestion.vatRate,
      vatOperationNature: suggestion.vatOperationNature as never,
      confidence: suggestion.confidence as Confidence,
      source: suggestion.source,
      aiRationale: suggestion.rationale,
      alternatives: suggestion.alternatives ?? undefined,
      isAnnualCharge: suggestion.isAnnualCharge ?? false,
      rulePackId,
      chartVersion: validation.chartVersion,
      validationStatus: validation.status as never,
      validationReasonsJson,
      validatedAt: validation.status === "VALIDATED" ? new Date() : null,
      status,
    },
    create: {
      fiscalYearId,
      transactionId: suggestion.transactionId,
      accountDebit: suggestion.accountDebit,
      accountDebitLabel: validation.accountDebitLabel ?? suggestion.accountDebitLabel,
      accountCredit: suggestion.accountCredit,
      accountCreditLabel: validation.accountCreditLabel ?? suggestion.accountCreditLabel,
      journal: suggestion.journal,
      ecritureLabel: suggestion.ecritureLabel,
      vatRate: suggestion.vatRate,
      vatOperationNature: suggestion.vatOperationNature as never,
      confidence: suggestion.confidence as Confidence,
      source: suggestion.source,
      aiRationale: suggestion.rationale,
      alternatives: suggestion.alternatives ?? undefined,
      isAnnualCharge: suggestion.isAnnualCharge ?? false,
      rulePackId,
      chartVersion: validation.chartVersion,
      validationStatus: validation.status as never,
      validationReasonsJson,
      validatedAt: validation.status === "VALIDATED" ? new Date() : null,
      status,
    },
  });
}

function needsReview(
  suggestion: CategorizationSuggestion,
  normalizedLabel: string,
  validation: AccountingAssignmentValidationResult,
  trust: CategorizationTrustDecision
) {
  if (validation.status !== "VALIDATED") return true;
  if (trust.reviewRequired || !trust.writable) return true;
  if (suggestion.confidence === "LOW") return true;
  if (suggestion.source === "AI" && suggestion.confidence === "MEDIUM") return true;
  return suggestion.source === "AI" && normalizedLabel.includes("depot comptes annuels");
}

function appendReason(existing: string | undefined, reason: string) {
  return existing ? `${existing} ${reason}` : reason;
}

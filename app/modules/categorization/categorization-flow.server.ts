import { CategorizationStatus, Confidence } from "@prisma/client";
import { getPeriodKey } from "../billing/usage-meter.server";
import { prisma } from "../db.server";
import { normalizeLabel } from "../import-pipeline/parsers";
import { AccountingAssignmentValidationPolicy, type AccountingAssignmentValidationResult } from "../accounting-reference/accounting-assignment-validation-policy.server";
import { AccountingReferencePolicyCenter } from "../accounting-reference/accounting-reference-policy-center.server";
import { AutoApplyReliabilityPolicy, type SupplierCategorizationHistoryItem } from "../accounting-reference/auto-apply-reliability-policy.server";
import { CategorizationTrustPolicy, type CategorizationTrustDecision } from "../accounting-reference/categorization-trust-policy.server";
import { ChartOfAccountsCenter } from "../accounting-reference/chart-of-accounts-center.server";
import { CompanyProfileClassificationCenter, type CompanyProfileClassification } from "../accounting-reference/company-profile-classification-center.server";
import { CategorizationEngine } from "./categorization-engine";
import { createAiCategorizationProvider } from "./provider-factory.server";
import type { CategorizationSuggestion, CategorizationTransaction } from "./types";

export async function categorizeImport(importId: string) {
  const importRow = await prisma.import.findUniqueOrThrow({
    where: { id: importId },
    include: { fiscalYear: { include: { company: true } }, transactions: true },
  });
  const company = importRow.fiscalYear.company;
  const profile = new CompanyProfileClassificationCenter().classifyCompanyProfile(company);
  const correctionRules = await loadCorrectionRulesForImport(company.id, importRow.fiscalYearId, importRow.fiscalYear.endDate);
  const vendorMappings = await prisma.vendorMapping.findMany({
    where: { active: true, OR: [{ companyId: null }, { companyId: company.id }] },
  });
  const activeRulePack = await prisma.accountingRulePack.findFirst({ where: { status: "ACTIVE" }, orderBy: { activatedAt: "desc" } });

  const engine = new CategorizationEngine(createAiCategorizationProvider());
  const validationPolicy = new AccountingAssignmentValidationPolicy();
  const accountPolicy = new AccountingReferencePolicyCenter();
  const trustPolicy = new CategorizationTrustPolicy();
  const autoApplyPolicy = new AutoApplyReliabilityPolicy();
  const [bankRole, suspenseRole] = await Promise.all([
    accountPolicy.getAccountRole("bank"),
    accountPolicy.getAccountRole("suspense"),
  ]);
  const supplierHistory = await loadSupplierCategorizationHistory(importRow.fiscalYearId, importId);
  const accountRoles = {
    bank: { account: bankRole.account, label: bankRole.label },
    suspense: { account: suspenseRole.account, label: suspenseRole.label },
  };
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
      incomeRegime: company.incomeRegime,
      vatRegime: company.vatRegime,
      companyTier: profile.tier,
      accountRoles,
      correctionRules: correctionRules.map((rule) => ({
        counterparty: rule.counterparty,
        preferredAccount: rule.preferredAccount,
        preferredAccountLabel: rule.preferredAccountLabel ?? undefined,
        preferredVatRate: rule.preferredVatRate === null ? null : Number(rule.preferredVatRate),
        vatOperationNature: rule.vatOperationNature,
        conflict: rule.conflict,
        sourceFiscalYearId: rule.fiscalYearId,
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
    const historyKey = supplierKeyForTransaction(transactionInput);
    const accounting = validateSuggestionForStorage(
      company,
      suggestion,
      transactionInput,
      historyKey ? supplierHistory.get(historyKey) ?? [] : [],
      validationPolicy,
      trustPolicy,
      autoApplyPolicy,
      accountRoles,
      profile
    );
    await upsertCategorization(
      importRow.fiscalYearId,
      company.id,
      company.userId,
      accounting.suggestion,
      normalizedLabel,
      accounting.validation,
      accounting.trust,
      activeRulePack?.id ?? null,
      profile
    );
  }
  await recordAiCategorizationUsage(importRow.fiscalYearId, company.id, company.userId, suggestions.filter((suggestion) => suggestion.source === "AI").length);

  const rows = await prisma.categorization.findMany({
    where: { transaction: { importId } },
    select: { status: true },
  });
  const reviewRows = rows.filter((row) => row.status === "NEEDS_REVIEW").length;
  const lightReviewRows = rows.filter((row) => row.status === "REVIEW_LIGHT").length;
  await prisma.import.update({
    where: { id: importId },
    data: {
      status: reviewRows > 0 ? "REVIEW" : "DONE",
      categorizedRows: rows.length,
      reviewRows,
      lightReviewRows,
      completedAt: new Date(),
    },
  });

  return { suggestions, reviewRows, lightReviewRows };
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
  company: { vatRegime: string; vatExigibility?: string | null },
  suggestion: CategorizationSuggestion,
  transaction: CategorizationTransaction | undefined,
  supplierHistory: SupplierCategorizationHistoryItem[],
  validationPolicy: AccountingAssignmentValidationPolicy,
  trustPolicy: CategorizationTrustPolicy,
  autoApplyPolicy: AutoApplyReliabilityPolicy,
  accountRoles: { bank: { account: string; label: string }; suspense: { account: string; label: string } },
  profile: CompanyProfileClassification
) {
  let suggestionToStore = suggestion;
  let validation = validationPolicy.validateSuggestion(company, suggestionToStore, transaction);
  const hasUnknownAccount = validation.blockingReasons.some((reason) => reason.includes("non reconnu"));
  if (suggestion.source === "AI" && hasUnknownAccount) {
    suggestionToStore = {
      ...suggestion,
      accountDebit: transaction?.type === "CREDIT" ? accountRoles.bank.account : accountRoles.suspense.account,
      accountDebitLabel: transaction?.type === "CREDIT" ? accountRoles.bank.label : accountRoles.suspense.label,
      accountCredit: transaction?.type === "CREDIT" ? accountRoles.suspense.account : accountRoles.bank.account,
      accountCreditLabel: transaction?.type === "CREDIT" ? accountRoles.suspense.label : accountRoles.bank.label,
      confidence: "LOW",
      rationale: appendReason(suggestion.rationale, "Compte proposé non reconnu par Qitus."),
    };
    validation = validationPolicy.validateSuggestion(company, suggestionToStore, transaction);
  }
  const autoApplyDecision = suggestionToStore.source === "AI"
    ? autoApplyPolicy.classifyAiSuggestion({
        suggestion: suggestionToStore,
        validation,
        transaction,
        supplierHistory,
        company,
        profile,
      })
    : undefined;
  return {
    suggestion: suggestionToStore,
    validation,
    trust: trustPolicy.classifySuggestion(suggestionToStore, validation, { autoApplyDecision }),
  };
}

async function upsertCategorization(
  fiscalYearId: string,
  companyId: string,
  userId: string | null,
  suggestion: CategorizationSuggestion,
  normalizedLabel: string,
  validation: AccountingAssignmentValidationResult,
  trust: CategorizationTrustDecision,
  rulePackId: string | null,
  profile: CompanyProfileClassification
) {
  const status = normalizedCategorizationStatus(suggestion, normalizedLabel, validation, trust);
  const validationReasonsJson = {
    blockingReasons: validation.blockingReasons,
    warnings: validation.warnings,
    trustReasons: trust.reasons,
    trustStatus: trust.status,
    userFacingResolution: trust.userFacingResolution,
    companyTier: profile.tier,
    confidenceThreshold: profile.config.confidenceThreshold,
    minHistoryMatches: profile.config.minHistoryMatches,
    blacklistExtensions: profile.config.blacklistExtensions,
    autoApplyReasons: trust.status === "AUTO_APPLIED" || trust.status === "REVIEW_LIGHT" ? trust.reasons : [],
    autoApplyAudit: trust.audit ?? null,
  };
  const categorization = await prisma.categorization.upsert({
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
  await recordCategorizationDecisionActivity({
    companyId,
    fiscalYearId,
    userId,
    transactionId: suggestion.transactionId,
    status,
    trust,
  });
  return categorization;
}

function normalizedCategorizationStatus(
  suggestion: CategorizationSuggestion,
  normalizedLabel: string,
  validation: AccountingAssignmentValidationResult,
  trust: CategorizationTrustDecision
) {
  if (validation.status !== "VALIDATED") return CategorizationStatus.NEEDS_REVIEW;
  if (suggestion.source === "AI" && normalizedLabel.includes("depot comptes annuels")) return CategorizationStatus.NEEDS_REVIEW;
  return trust.categorizationStatus as CategorizationStatus;
}

function appendReason(existing: string | undefined, reason: string) {
  return existing ? `${existing} ${reason}` : reason;
}

async function recordCategorizationDecisionActivity(input: {
  companyId: string;
  fiscalYearId: string;
  userId: string | null;
  transactionId: string;
  status: CategorizationStatus;
  trust: CategorizationTrustDecision;
}) {
  const action = input.status === "AUTO_APPLIED"
    ? "transaction.auto_applied"
    : input.status === "REVIEW_LIGHT"
      ? "transaction.review_light"
      : input.status === "NEEDS_REVIEW"
        ? "transaction.needs_review"
        : null;
  if (!action) return;
  await prisma.activityLog.create({
    data: {
      companyId: input.companyId,
      fiscalYearId: input.fiscalYearId,
      userId: input.userId,
      action,
      entityType: "transaction",
      entityId: input.transactionId,
      metadata: {
        trustStatus: input.trust.status,
        userFacingResolution: input.trust.userFacingResolution,
        reasons: input.trust.reasons.slice(0, 5),
      },
    },
  });
}

async function loadSupplierCategorizationHistory(fiscalYearId: string, currentImportId: string) {
  const rows = await prisma.transaction.findMany({
    where: { fiscalYearId, importId: { not: currentImportId } },
    include: { categorization: true },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
  const history = new Map<string, SupplierCategorizationHistoryItem[]>();
  for (const transaction of rows) {
    const categorization = transaction.categorization;
    if (!categorization || ["NEEDS_REVIEW", "REVIEW_LIGHT"].includes(categorization.status)) continue;
    const key = supplierKeyForTransaction({
      id: transaction.id,
      date: transaction.date.toISOString().slice(0, 10),
      label: transaction.label,
      normalizedLabel: transaction.normalizedLabel || normalizeLabel(transaction.label),
      counterparty: transaction.counterparty ?? undefined,
      amount: Number(transaction.amount),
      currency: transaction.currency,
      type: transaction.type,
      sourceId: transaction.sourceId ?? undefined,
      sourceRef: transaction.sourceRef ?? undefined,
      sourceCategory: transaction.sourceCategory ?? undefined,
      notes: transaction.notes ?? undefined,
    });
    if (!key) continue;
    const items = history.get(key) ?? [];
    items.push({
      accountDebit: categorization.accountDebit,
      accountCredit: categorization.accountCredit,
      vatRate: categorization.vatRate === null ? null : Number(categorization.vatRate),
      vatOperationNature: categorization.vatOperationNature,
      amount: Number(transaction.amount),
      status: categorization.status,
      source: categorization.source,
    });
    history.set(key, items);
  }
  return history;
}

async function loadCorrectionRulesForImport(companyId: string, fiscalYearId: string, fiscalYearEndDate: Date) {
  const chart = new ChartOfAccountsCenter();
  const rules = await prisma.correctionRule.findMany({
    where: {
      active: true,
      fiscalYear: {
        companyId,
        endDate: { lte: fiscalYearEndDate },
      },
    },
    include: { fiscalYear: true },
    orderBy: [{ fiscalYear: { endDate: "desc" } }, { updatedAt: "desc" }],
  });
  const byCounterparty = new Map<string, typeof rules>();
  for (const rule of rules) {
    if (!chart.isPostableAccount(rule.preferredAccount)) continue;
    const key = rule.counterparty.trim().toLowerCase();
    byCounterparty.set(key, [...(byCounterparty.get(key) ?? []), rule]);
  }
  return [...byCounterparty.values()].flatMap((items) => {
    const current = items.filter((rule) => rule.fiscalYearId === fiscalYearId);
    const candidates = current.length > 0 ? current : items;
    const first = candidates[0];
    if (!first) return [];
    const conflict = items.some((candidate) => !sameCorrectionDecision(candidate, first));
    return [{ ...first, conflict }];
  });
}

function sameCorrectionDecision(
  left: { preferredAccount: string; preferredVatRate: unknown; vatOperationNature: string | null },
  right: { preferredAccount: string; preferredVatRate: unknown; vatOperationNature: string | null }
) {
  return left.preferredAccount === right.preferredAccount
    && numberOrNull(left.preferredVatRate) === numberOrNull(right.preferredVatRate)
    && left.vatOperationNature === right.vatOperationNature;
}

function numberOrNull(value: unknown) {
  return value === null || value === undefined ? null : Number(value);
}

function supplierKeyForTransaction(transaction: CategorizationTransaction | undefined) {
  const key = transaction?.counterparty?.trim() || transaction?.normalizedLabel?.trim();
  return key ? key.toLowerCase() : null;
}

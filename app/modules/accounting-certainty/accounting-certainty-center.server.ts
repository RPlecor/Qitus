import type { Categorization, JournalEntry, JournalLine, Transaction } from "@prisma/client";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { AccountingAssignmentValidationPolicy } from "../accounting-reference/accounting-assignment-validation-policy.server";
import { ChartOfAccountsCenter } from "../accounting-reference/chart-of-accounts-center.server";
import { JournalAuditCenter } from "../journal/journal-audit-center.server";
import { DocumentFreshnessCenter } from "../documents/document-freshness-center.server";
import { EvidenceControlCenter } from "../evidence/evidence-control-center.server";
import { isTransactionInReview } from "../transactions/transaction-review-state";
import type { CategorizationSuggestion } from "../categorization/types";

export type AccountingCertaintyStatus = "verified" | "review_light" | "needs_review" | "blocked" | "not_applicable";
export type AccountingCertaintyTone = "success" | "warning" | "blocking" | "info";

export type AccountingCertaintyAction = {
  label: string;
  href: string;
};

export type AccountingCertaintyReason = {
  label: string;
  tone: AccountingCertaintyTone;
  source:
    | "pcg"
    | "reference"
    | "categorization"
    | "user_validation"
    | "vat"
    | "journal"
    | "evidence"
    | "reconciliation"
    | "documents";
  referenceVersion?: string;
  action?: AccountingCertaintyAction;
};

export type AccountingCertaintyResult = {
  status: AccountingCertaintyStatus;
  label: "Vérifié" | "À relire rapidement" | "À relire" | "Bloqué" | "Non applicable";
  tone: AccountingCertaintyTone;
  reasons: AccountingCertaintyReason[];
  primaryAction?: AccountingCertaintyAction;
};

export type AccountingCertaintySummary = {
  status: AccountingCertaintyStatus;
  label: "Certitude du dossier";
  verified: number;
  reviewLight: number;
  needsReview: number;
  blocked: number;
  notApplicable: number;
  total: number;
  reasons: AccountingCertaintyReason[];
  primaryAction: AccountingCertaintyAction;
};

export type AccountingCertaintyIssue = {
  key: string;
  title: string;
  detail: string;
  status: Exclude<AccountingCertaintyStatus, "verified" | "not_applicable">;
  entityType?: "transaction" | "journal_entry" | "document" | "evidence";
  entityId?: string;
  action: AccountingCertaintyAction;
};

type TransactionWithCertaintyRelations = Transaction & { categorization: Categorization | null };
type JournalEntryWithLines = JournalEntry & { lines: JournalLine[]; transactions: TransactionWithCertaintyRelations[] };

export class AccountingCertaintyCenter {
  constructor(
    private readonly validationPolicy = new AccountingAssignmentValidationPolicy(),
    private readonly chart = new ChartOfAccountsCenter(),
    private readonly journalAudit = new JournalAuditCenter(),
    private readonly evidence = new EvidenceControlCenter(),
    private readonly freshness = new DocumentFreshnessCenter()
  ) {}

  async getTransactionCertainty(workspace: CompanyWorkspace, transactionId: string): Promise<AccountingCertaintyResult> {
    const transaction = await prisma.transaction.findFirstOrThrow({
      where: { id: transactionId, fiscalYearId: workspace.fiscalYear.id },
      include: { categorization: true },
    });
    return this.transactionCertaintyFromRecord(workspace, transaction);
  }

  async getJournalEntryCertainty(workspace: CompanyWorkspace, journalEntryId: string): Promise<AccountingCertaintyResult> {
    const entry = await prisma.journalEntry.findFirstOrThrow({
      where: { id: journalEntryId, fiscalYearId: workspace.fiscalYear.id },
      include: { lines: true, transactions: { include: { categorization: true } } },
    });
    return this.journalEntryCertaintyFromRecord(workspace, entry);
  }

  async getFiscalYearCertaintySummary(workspace: CompanyWorkspace): Promise<AccountingCertaintySummary> {
    const [transactions, entries, audit, evidence, freshness] = await Promise.all([
      prisma.transaction.findMany({ where: { fiscalYearId: workspace.fiscalYear.id }, include: { categorization: true } }),
      prisma.journalEntry.findMany({ where: { fiscalYearId: workspace.fiscalYear.id }, include: { lines: true, transactions: { include: { categorization: true } } } }),
      this.journalAudit.getAuditSummary(workspace).catch(() => null),
      this.evidence.getEvidenceReview(workspace).catch(() => null),
      this.freshness.getFreshness(workspace).catch(() => null),
    ]);
    const transactionResults = transactions.map((transaction) => this.transactionCertaintyFromRecord(workspace, transaction));
    const entryResults = entries.map((entry) => this.journalEntryCertaintyFromRecord(workspace, entry));
    const results = [...transactionResults, ...entryResults];
    let verified = results.filter((result) => result.status === "verified").length;
    let reviewLight = results.filter((result) => result.status === "review_light").length;
    let needsReview = results.filter((result) => result.status === "needs_review").length;
    let blocked = results.filter((result) => result.status === "blocked").length;
    const notApplicable = results.filter((result) => result.status === "not_applicable").length;
    const reasons: AccountingCertaintyReason[] = [];

    if (audit?.blockingCount) {
      blocked += audit.blockingCount;
      reasons.push(reason("Journal à corriger avant export", "blocking", "journal", { label: "Ouvrir le contrôle", href: "/controle" }));
    } else if (audit?.status === "exportable") {
      reasons.push(reason("Écritures équilibrées", "success", "journal"));
    }

    if (evidence && evidence.requiredMissing > 0) {
      needsReview += evidence.requiredMissing;
      reasons.push(reason("Justificatifs à compléter", "warning", "evidence", { label: "Ouvrir les justificatifs", href: "/pieces" }));
    } else if (evidence?.status === "ready") {
      reasons.push(reason("Justificatifs couverts", "success", "evidence"));
    }

    if (freshness && freshness.staleCount > 0) {
      needsReview += freshness.staleCount;
      reasons.push(reason("Documents à mettre à jour", "warning", "documents", { label: "Ouvrir les documents", href: "/documents" }));
    }

    if (verified === 0 && needsReview === 0 && blocked === 0 && transactions.length === 0 && entries.length === 0) {
      return {
        status: "not_applicable",
        label: "Certitude du dossier",
        verified: 0,
        reviewLight: 0,
        needsReview: 0,
        blocked: 0,
        notApplicable: 1,
        total: 1,
        reasons: [reason("Aucune donnée comptable à vérifier pour le moment", "info", "reference", { label: "Importer un relevé", href: "/imports" })],
        primaryAction: { label: "Importer un relevé", href: "/imports" },
      };
    }

    const total = Math.max(verified + reviewLight + needsReview + blocked + notApplicable, results.length);
    return {
      status: blocked > 0 ? "blocked" : needsReview > 0 ? "needs_review" : reviewLight > 0 ? "review_light" : "verified",
      label: "Certitude du dossier",
      verified,
      reviewLight,
      needsReview,
      blocked,
      notApplicable,
      total,
      reasons: reasons.slice(0, 5),
      primaryAction: { label: blocked > 0 || needsReview > 0 ? "Ouvrir le contrôle" : "Voir le contrôle", href: "/controle" },
    };
  }

  async getCertaintyIssues(workspace: CompanyWorkspace): Promise<AccountingCertaintyIssue[]> {
    const [reviewTransactions, audit, evidence, freshness] = await Promise.all([
      prisma.transaction.findMany({
        where: { fiscalYearId: workspace.fiscalYear.id, categorization: { status: "NEEDS_REVIEW" } },
        select: { id: true, label: true },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 25,
      }),
      this.journalAudit.getAuditSummary(workspace).catch(() => null),
      this.evidence.getEvidenceReview(workspace).catch(() => null),
      this.freshness.getFreshness(workspace).catch(() => null),
    ]);
    const issues: AccountingCertaintyIssue[] = reviewTransactions.map((transaction) => ({
      key: `transaction:${transaction.id}`,
      title: "Transaction à relire",
      detail: transaction.label,
      status: "needs_review",
      entityType: "transaction",
      entityId: transaction.id,
      action: { label: "Ouvrir la transaction", href: `/transactions/${transaction.id}` },
    }));
    for (const issue of audit?.issues ?? []) {
      issues.push({
        key: `journal:${issue.code}:${issue.entryId}`,
        title: issue.severity === "blocking" ? "Écriture bloquante" : "Écriture à relire",
        detail: issue.detail,
        status: issue.severity === "blocking" ? "blocked" : "needs_review",
        entityType: "journal_entry",
        entityId: issue.entryId,
        action: { label: "Ouvrir le contrôle", href: "/controle" },
      });
    }
    if (evidence && evidence.requiredMissing > 0) {
      issues.push({
        key: "evidence:missing",
        title: "Justificatifs à compléter",
        detail: `${evidence.requiredMissing} écriture${evidence.requiredMissing > 1 ? "s" : ""} sans justificatif rattaché.`,
        status: "needs_review",
        entityType: "evidence",
        action: { label: "Ouvrir les justificatifs", href: "/pieces" },
      });
    }
    if (freshness && freshness.staleCount > 0) {
      issues.push({
        key: "documents:freshness",
        title: "Documents à mettre à jour",
        detail: `${freshness.staleCount} document${freshness.staleCount > 1 ? "s" : ""} à régénérer après les dernières écritures.`,
        status: "needs_review",
        entityType: "document",
        action: { label: "Ouvrir les documents", href: "/documents" },
      });
    }
    return issues.slice(0, 50);
  }

  transactionCertaintyFromRecord(workspace: CompanyWorkspace, transaction: TransactionWithCertaintyRelations): AccountingCertaintyResult {
    const action = { label: "Ouvrir la transaction", href: `/transactions/${transaction.id}` };
    if (!transaction.categorization) {
      return result("needs_review", [reason("Compte à confirmer", "warning", "categorization", action)], action);
    }
    const suggestion = toSuggestion(transaction);
    if (!suggestion) {
      return result("needs_review", [reason("Catégorisation incomplète", "warning", "categorization", action)], action);
    }
    const validation = this.validationPolicy.validateSuggestion(workspace.company, suggestion, {
      ...transaction,
      amount: Number(transaction.amount),
    });
    const reasons: AccountingCertaintyReason[] = [];
    const validationAction = validation.status === "BLOCKED" ? { label: "Corriger la transaction", href: `/transactions/${transaction.id}` } : action;
    for (const label of validation.blockingReasons) reasons.push(reason(label, "blocking", "pcg", validationAction, validation.chartVersion));
    for (const label of validation.warnings) reasons.push(reason(label, "warning", "categorization", action, validation.chartVersion));
    if (isTransactionInReview(transaction.categorization)) {
      reasons.push(reason("Décision utilisateur nécessaire", "warning", "user_validation", action));
    }
    if (transaction.categorization.status === "REVIEW_LIGHT") {
      reasons.push(reason("À relire rapidement avant création d'écriture", "info", "categorization", action));
    }
    if (transaction.categorization.status === "AUTO_APPLIED") {
      reasons.push(reason("Appliqué automatiquement — corrigeable", "success", "categorization", action));
    }
    if (transaction.categorization.source === "AI" && transaction.categorization.status !== "AUTO_APPLIED" && transaction.categorization.status !== "REVIEW_LIGHT") {
      reasons.push(reason("Suggestion à confirmer", "warning", "categorization", action));
    }
    if (transaction.categorization.confidence !== "HIGH") {
      reasons.push(reason("Confiance à confirmer", "warning", "categorization", action));
    }
    if (validation.status === "BLOCKED") return result("blocked", reasons, validationAction);
    if (transaction.categorization.status === "REVIEW_LIGHT") return result("review_light", reasons, action);
    if (validation.reviewRequired || reasons.some((item) => item.tone === "warning")) return result("needs_review", reasons, action);

    return result("verified", [
      reason("Compte validé par le plan comptable Qitus", "success", "pcg", undefined, validation.chartVersion),
      sourceReason(transaction.categorization),
      transaction.categorization.vatRate || transaction.categorization.vatOperationNature
        ? reason("TVA cohérente avec le référentiel actif", "success", "vat")
        : reason("TVA non applicable", "info", "vat"),
    ]);
  }

  journalEntryCertaintyFromRecord(workspace: CompanyWorkspace, entry: JournalEntryWithLines): AccountingCertaintyResult {
    const action = { label: "Ouvrir le contrôle", href: "/controle" };
    const reasons: AccountingCertaintyReason[] = [];
    if (entry.lines.length === 0) reasons.push(reason("Écriture sans ligne comptable", "blocking", "journal", action));
    let debit = 0;
    let credit = 0;
    for (const line of entry.lines) {
      debit += Number(line.debit);
      credit += Number(line.credit);
      const account = this.chart.getAccount(line.account);
      if (!account) reasons.push(reason(`Compte ${line.account} absent du plan comptable Qitus`, "blocking", "pcg", action, this.chart.getActiveChartVersion()));
      else if (!account.isPostable) reasons.push(reason(`Compte ${line.account} non utilisable pour une écriture`, "blocking", "pcg", action, this.chart.getActiveChartVersion()));
      if (Number(line.debit) === 0 && Number(line.credit) === 0) reasons.push(reason(`Ligne ${line.account} sans montant`, "blocking", "journal", action));
      if (Number(line.debit) > 0 && Number(line.credit) > 0) reasons.push(reason(`Ligne ${line.account} avec débit et crédit simultanés`, "blocking", "journal", action));
    }
    if (Math.abs(debit - credit) >= 0.005) reasons.push(reason("Écriture déséquilibrée", "blocking", "journal", action));
    for (const transaction of entry.transactions) {
      const transactionCertainty = this.transactionCertaintyFromRecord(workspace, transaction);
      if (transactionCertainty.status === "blocked") reasons.push(reason("Transaction liée bloquante", "blocking", "categorization", { label: "Ouvrir la transaction", href: `/transactions/${transaction.id}` }));
      if (transactionCertainty.status === "needs_review") reasons.push(reason("Transaction liée à relire", "warning", "categorization", { label: "Ouvrir la transaction", href: `/transactions/${transaction.id}` }));
    }
    if (reasons.some((item) => item.tone === "blocking")) return result("blocked", reasons, action);
    if (reasons.some((item) => item.tone === "warning")) return result("needs_review", reasons, action);
    return result("verified", [
      reason("Écriture équilibrée", "success", "journal"),
      reason("Comptes validés par le plan comptable Qitus", "success", "pcg", undefined, this.chart.getActiveChartVersion()),
    ]);
  }
}

function toSuggestion(transaction: TransactionWithCertaintyRelations): CategorizationSuggestion | null {
  const categorization = transaction.categorization;
  if (!categorization?.accountDebit || !categorization.accountCredit || !categorization.journal || !categorization.ecritureLabel) return null;
  return {
    transactionId: transaction.id,
    accountDebit: categorization.accountDebit,
    accountDebitLabel: categorization.accountDebitLabel ?? undefined,
    accountCredit: categorization.accountCredit,
    accountCreditLabel: categorization.accountCreditLabel ?? undefined,
    journal: categorization.journal,
    ecritureLabel: categorization.ecritureLabel,
    vatRate: categorization.vatRate === null ? null : Number(categorization.vatRate),
    vatOperationNature: categorization.vatOperationNature ?? null,
    confidence: categorization.confidence,
    source: categorization.source,
    rationale: categorization.aiRationale ?? undefined,
    isAnnualCharge: categorization.isAnnualCharge,
  };
}

function result(status: AccountingCertaintyStatus, reasons: AccountingCertaintyReason[], primaryAction?: AccountingCertaintyAction): AccountingCertaintyResult {
  const labels: Record<AccountingCertaintyStatus, AccountingCertaintyResult["label"]> = {
      verified: "Vérifié",
    review_light: "À relire rapidement",
    needs_review: "À relire",
    blocked: "Bloqué",
    not_applicable: "Non applicable",
  };
  const tones: Record<AccountingCertaintyStatus, AccountingCertaintyTone> = {
    verified: "success",
    review_light: "info",
    needs_review: "warning",
    blocked: "blocking",
    not_applicable: "info",
  };
  return { status, label: labels[status], tone: tones[status], reasons, primaryAction };
}

function reason(
  label: string,
  tone: AccountingCertaintyTone,
  source: AccountingCertaintyReason["source"],
  action?: AccountingCertaintyAction,
  referenceVersion?: string
): AccountingCertaintyReason {
  return { label, tone, source, action, referenceVersion };
}

function sourceReason(categorization: Categorization): AccountingCertaintyReason {
  if (categorization.status === "USER_CONFIRMED") return reason("Correction utilisateur confirmée", "success", "user_validation");
  if (categorization.status === "USER_CORRECTED" || categorization.status === "MANUAL" || categorization.source === "MANUAL") {
    return reason("Correction utilisateur confirmée", "success", "user_validation");
  }
  if (categorization.source === "CORRECTION_RULE") return reason("Règle fournisseur appliquée", "success", "categorization");
  if (categorization.source === "VENDOR_LOOKUP" || categorization.source === "PATTERN_MATCH") return reason("Règle fournisseur appliquée", "success", "categorization");
  if (categorization.status === "AUTO_APPLIED") return reason("Appliqué automatiquement — corrigeable", "success", "categorization");
  return reason("Catégorisation validée par Qitus", "success", "categorization");
}

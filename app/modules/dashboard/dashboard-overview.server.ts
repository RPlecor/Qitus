import type { DocumentType } from "@prisma/client";
import { AccountingReviewCenter, type AccountingReview } from "../accounting-review/accounting-review-center.server";
import { AccountingCoverageCenter, type AccountingCoverageOverview } from "../accounting-coverage/accounting-coverage-center.server";
import { ChangeImpactCenter, type ChangeImpactOverview } from "../change-impacts/change-impact-center.server";
import { ClosingAdjustmentCenter } from "../closing-adjustments/closing-adjustment-center.server";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { DocumentFreshnessCenter } from "../documents/document-freshness-center.server";
import { getRuntimeConfig } from "../runtime-config.server";
import { isTransactionInReview } from "../transactions/transaction-review-state";
import { computeDashboardKpis, type DashboardKpis } from "./dashboard";

export type DashboardAlert = {
  type: "review" | "documents" | "imports" | "accounting" | "closing_adjustments" | "coverage";
  tone: "orange" | "blue" | "red";
  message: string;
};

export type DashboardTransaction = {
  id: string;
  date: string;
  label: string;
  amount: string;
  account: string;
  needsReview: boolean;
};

export type DashboardComparison = {
  previousFiscalYear: number;
  revenueDelta: number;
  expensesDelta: number;
  resultDelta: number;
};

export type DashboardOverviewResult = {
  kpis: DashboardKpis;
  alerts: DashboardAlert[];
  comparison: DashboardComparison | null;
  documentFreshness: { staleCount: number } | null;
  closingAdjustments: { draft: number; approved: number; rejected: number } | null;
  coverage: { score: number; label: string; highRisk: number } | null;
  changeImpacts: Pick<ChangeImpactOverview, "mode" | "status" | "total" | "blocking" | "actionRequired" | "warning" | "impacts" | "performanceBudget"> | null;
  transactionState: { reviewCount: number };
  recentTransactions: DashboardTransaction[];
};

export class DashboardOverview {
  async getOverview(input: string | CompanyWorkspace, _options: { includeComparison?: boolean } = {}): Promise<DashboardOverviewResult> {
    const fiscalYearId = typeof input === "string" ? input : input.fiscalYear.id;
    const [entries, reviewCount, importCount, documents, transactions] = await Promise.all([
      prisma.journalEntry.findMany({ where: { fiscalYearId }, include: { lines: true } }),
      prisma.categorization.count({ where: { fiscalYearId, status: "NEEDS_REVIEW" } }),
      prisma.import.count({ where: { fiscalYearId } }),
      prisma.document.findMany({ where: { fiscalYearId, status: "READY" }, select: { type: true } }),
      prisma.transaction.findMany({
        where: { fiscalYearId },
        include: { categorization: true },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 5,
      }),
    ]);
    const changeImpactMode = getRuntimeConfig().changeImpactsMode;
    const [accountingReview, freshness, closingAdjustments, coverage, comparison, changeImpacts] = typeof input === "string"
      ? [null, null, null, null, null, null] as const
      : await Promise.all([
          new AccountingReviewCenter().getReview(input),
          new DocumentFreshnessCenter().getFreshness(input),
          new ClosingAdjustmentCenter().summarizeClosingAdjustments(input),
          new AccountingCoverageCenter().getCoverageOverview(input),
          this.getComparison(input),
          changeImpactMode === "off" ? null : new ChangeImpactCenter().getImpactOverview(input, { surface: "dashboard" }),
        ]);
    const alerts = buildDashboardAlerts(reviewCount, importCount, documents.map((document) => document.type), accountingReview, {
      staleDocuments: freshness?.staleCount ?? 0,
      draftAdjustments: closingAdjustments?.draft ?? 0,
      coverage,
    });

    return {
      kpis: computeDashboardKpis(entriesToDrafts(entries)),
      alerts: changeImpactMode === "active" && changeImpacts ? filterDashboardAlertsForActiveImpacts(alerts, changeImpacts) : alerts,
      comparison,
      documentFreshness: freshness ? { staleCount: freshness.staleCount } : null,
      closingAdjustments,
      coverage: coverage ? { score: coverage.score, label: coverage.label, highRisk: coverage.highRisk } : null,
      changeImpacts: changeImpacts ? {
        mode: changeImpacts.mode,
        status: changeImpacts.status,
        total: changeImpacts.total,
        blocking: changeImpacts.blocking,
        actionRequired: changeImpacts.actionRequired,
        warning: changeImpacts.warning,
        impacts: changeImpacts.impacts,
        performanceBudget: changeImpacts.performanceBudget,
      } : null,
      transactionState: { reviewCount },
      recentTransactions: transactions.map((transaction) => ({
        id: transaction.id,
        date: transaction.date.toISOString(),
        label: transaction.label,
        amount: transaction.amount.toString(),
        account: displayAccount(Number(transaction.amount), transaction.categorization),
        needsReview: isTransactionInReview(transaction.categorization),
      })),
    };
  }

  async getKpis(workspace: CompanyWorkspace): Promise<DashboardKpis> {
    return (await this.getOverview(workspace)).kpis;
  }

  async getAlerts(workspace: CompanyWorkspace): Promise<DashboardAlert[]> {
    return (await this.getOverview(workspace)).alerts;
  }

  async getComparison(workspace: CompanyWorkspace): Promise<DashboardComparison | null> {
    const previousFiscalYear = await prisma.fiscalYear.findFirst({
      where: { companyId: workspace.company.id, endDate: { lt: workspace.fiscalYear.startDate } },
      orderBy: { endDate: "desc" },
    });
    if (!previousFiscalYear) return null;
    const [current, previous] = await Promise.all([
      computeKpisForFiscalYear(workspace.fiscalYear.id),
      computeKpisForFiscalYear(previousFiscalYear.id),
    ]);
    return {
      previousFiscalYear: previousFiscalYear.startDate.getFullYear(),
      revenueDelta: current.revenue - previous.revenue,
      expensesDelta: current.expenses - previous.expenses,
      resultDelta: current.result - previous.result,
    };
  }
}

export function filterDashboardAlertsForActiveImpacts(alerts: DashboardAlert[], impacts: Pick<ChangeImpactOverview, "impacts">): DashboardAlert[] {
  const sources = new Set(impacts.impacts.map((impact) => impact.source));
  return alerts.filter((alert) => {
    if (alert.type === "documents" && (sources.has("documents") || sources.has("fec"))) return false;
    if (alert.type === "closing_adjustments" && sources.has("closing")) return false;
    if (alert.type === "coverage" && sources.has("fec")) return false;
    return true;
  });
}

async function computeKpisForFiscalYear(fiscalYearId: string) {
  const entries = await prisma.journalEntry.findMany({ where: { fiscalYearId }, include: { lines: true } });
  return computeDashboardKpis(entriesToDrafts(entries));
}

function entriesToDrafts(entries: Array<{ num: number; date: Date; journal: string; ref: string | null; label: string; lines: Array<{ account: string; accountLabel: string | null; debit: unknown; credit: unknown }> }>) {
  return entries.map((entry) => ({
    num: entry.num,
    date: entry.date.toISOString().slice(0, 10),
    journal: entry.journal,
    ref: entry.ref ?? undefined,
    label: entry.label,
    source: "IMPORT" as const,
    transactionId: "",
    lines: entry.lines.map((line) => ({
      account: line.account,
      accountLabel: line.accountLabel ?? undefined,
      debit: Number(line.debit),
      credit: Number(line.credit),
    })),
  }));
}

export function buildDashboardAlerts(
  reviewCount: number,
  importCount: number,
  documentTypes: DocumentType[],
  accountingReview?: AccountingReview | null,
  options: { staleDocuments?: number; draftAdjustments?: number; coverage?: AccountingCoverageOverview | null } = {}
): DashboardAlert[] {
  const alerts: DashboardAlert[] = [];
  if (importCount === 0) {
    alerts.push({ type: "imports", tone: "blue", message: "Aucun import bancaire n'a encore été lancé." });
  }
  if (reviewCount > 0) {
    alerts.push({ type: "review", tone: "orange", message: `${reviewCount} transaction${reviewCount > 1 ? "s" : ""} à vérifier avant génération complète des écritures.` });
  }
  if (!documentTypes.includes("FEC")) {
    alerts.push({ type: "documents", tone: "blue", message: "Le FEC n'a pas encore été généré pour cet exercice." });
  }
  if ((options.staleDocuments ?? 0) > 0) {
    alerts.push({ type: "documents", tone: "orange", message: `${options.staleDocuments} document${options.staleDocuments! > 1 ? "s" : ""} à régénérer après les dernières écritures.` });
  }
  if ((options.draftAdjustments ?? 0) > 0) {
    alerts.push({ type: "closing_adjustments", tone: "orange", message: `${options.draftAdjustments} OD brouillon${options.draftAdjustments! > 1 ? "s" : ""} à relire dans Contrôle.` });
  }
  if (accountingReview && accountingReview.warningCount > 0 && accountingReview.blockingCount === 0) {
    alerts.push({
      type: "accounting",
      tone: "orange",
      message: `${accountingReview.warningCount} point${accountingReview.warningCount > 1 ? "s" : ""} de pré-clôture à revoir dans Contrôle.`,
    });
  }
  if (options.coverage && options.coverage.status !== "beta_ready") {
    alerts.push({
      type: "coverage",
      tone: options.coverage.highRisk > 0 ? "red" : "orange",
      message: `${options.coverage.label} : score ${options.coverage.score}/100.`,
    });
  }
  return alerts;
}

function displayAccount(amount: number, categorization: { accountDebit: string | null; accountCredit: string | null } | null) {
  if (!categorization) return "471";
  return amount >= 0 ? categorization.accountCredit ?? "471" : categorization.accountDebit ?? "471";
}

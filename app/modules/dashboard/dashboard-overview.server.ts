import type { DocumentType } from "@prisma/client";
import { assertActionableGuidance, type ActionableGuidance, type ActionableGuidanceTone } from "../actionable-guidance";
import { AccountingReviewCenter, type AccountingReview } from "../accounting-review/accounting-review-center.server";
import { AccountingCoverageCenter, type AccountingCoverageOverview } from "../accounting-coverage/accounting-coverage-center.server";
import { AutomationOpportunityCenter, summarizeAutomationOpportunities, type AutomationOpportunity } from "../automation/automation-opportunity-center.server";
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
} & ActionableGuidance;

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
  automation: {
    mode: string;
    total: number;
    safeRunnable: number;
    suggestions: number;
    validationRequired: number;
    opportunities: AutomationOpportunity[];
  } | null;
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
    const [accountingReview, freshness, closingAdjustments, coverage, comparison, changeImpacts, automationData] = typeof input === "string"
      ? [null, null, null, null, null, null, null] as const
      : await Promise.all([
          new AccountingReviewCenter().getReview(input),
          new DocumentFreshnessCenter().getFreshness(input),
          new ClosingAdjustmentCenter().summarizeClosingAdjustments(input),
          new AccountingCoverageCenter().getCoverageOverview(input),
          this.getComparison(input),
          changeImpactMode === "off" ? null : new ChangeImpactCenter().getImpactOverview(input, { surface: "dashboard" }),
          this.getAutomation(input),
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
      automation: automationData,
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

  private async getAutomation(workspace: CompanyWorkspace): Promise<DashboardOverviewResult["automation"]> {
    const center = new AutomationOpportunityCenter();
    const allOpportunities = await center.getOpportunities(workspace);
    const summary = summarizeAutomationOpportunities(getRuntimeConfig().automationMode, allOpportunities);
    return {
      mode: summary.mode,
      total: summary.total,
      safeRunnable: summary.safeRunnable,
      suggestions: summary.suggestions,
      validationRequired: summary.validationRequired,
      opportunities: allOpportunities.slice(0, 5),
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
    alerts.push(dashboardAlert({
      type: "imports",
      tone: "info",
      title: "Aucun import bancaire",
      message: "Importez un relevé bancaire pour démarrer le dossier.",
      primaryAction: { label: "Importer un relevé", href: "/imports" },
    }));
  }
  if (reviewCount > 0) {
    alerts.push(dashboardAlert({
      type: "review",
      tone: "warning",
      title: "Transactions à vérifier",
      message: `${reviewCount} transaction${reviewCount > 1 ? "s" : ""} à vérifier avant génération complète des écritures.`,
      primaryAction: { label: "Corriger les transactions", href: "/transactions?status=review" },
    }));
  }
  if (!documentTypes.includes("FEC")) {
    alerts.push(dashboardAlert({
      type: "documents",
      tone: "info",
      title: "FEC non généré",
      message: "Le FEC n'a pas encore été généré pour cet exercice.",
      primaryAction: { label: "Générer le FEC", href: "/documents" },
    }));
  }
  if ((options.staleDocuments ?? 0) > 0) {
    alerts.push(dashboardAlert({
      type: "documents",
      tone: "warning",
      title: "Documents à régénérer",
      message: `${options.staleDocuments} document${options.staleDocuments! > 1 ? "s" : ""} sont obsolètes après les dernières écritures.`,
      primaryAction: { label: "Ouvrir les documents", href: "/documents" },
    }));
  }
  if ((options.draftAdjustments ?? 0) > 0) {
    alerts.push(dashboardAlert({
      type: "closing_adjustments",
      tone: "warning",
      title: "OD brouillon à relire",
      message: `${options.draftAdjustments} OD brouillon${options.draftAdjustments! > 1 ? "s" : ""} attend${options.draftAdjustments! > 1 ? "ent" : ""} une décision.`,
      primaryAction: { label: "Relire les OD", href: "/cloture/od" },
    }));
  }
  if (accountingReview && accountingReview.warningCount > 0 && accountingReview.blockingCount === 0) {
    alerts.push(dashboardAlert({
      type: "accounting",
      tone: "warning",
      title: "Pré-clôture à revoir",
      message: `${accountingReview.warningCount} point${accountingReview.warningCount > 1 ? "s" : ""} de pré-clôture à revoir dans Contrôle.`,
      primaryAction: { label: "Ouvrir le contrôle", href: "/controle" },
    }));
  }
  if (options.coverage && options.coverage.status !== "beta_ready") {
    alerts.push(dashboardAlert({
      type: "coverage",
      tone: options.coverage.highRisk > 0 ? "blocking" : "warning",
      title: "Couverture EC à compléter",
      message: `${options.coverage.label} : score ${options.coverage.score}/100.`,
      primaryAction: { label: "Ouvrir la couverture", href: "/couverture" },
    }));
  }
  return alerts;
}

function dashboardAlert(input: {
  type: DashboardAlert["type"];
  tone: ActionableGuidanceTone;
  title: string;
  message: string;
  primaryAction: NonNullable<ActionableGuidance["primaryAction"]>;
}): DashboardAlert {
  return {
    type: input.type,
    ...assertActionableGuidance({
      title: input.title,
      message: input.message,
      tone: input.tone,
      primaryAction: input.primaryAction,
      source: "dashboard",
      isActionRequired: true,
    }),
  };
}

function displayAccount(amount: number, categorization: { accountDebit: string | null; accountCredit: string | null } | null) {
  if (!categorization) return "471";
  return amount >= 0 ? categorization.accountCredit ?? "471" : categorization.accountDebit ?? "471";
}

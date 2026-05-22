import { ClosingAdjustmentCenter } from "../closing-adjustments/closing-adjustment-center.server";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { CorrectionRuleImpactCenter } from "../correction-rules/correction-rule-impact-center.server";
import { DocumentFreshnessCenter } from "../documents/document-freshness-center.server";
import { TransactionExplorer } from "../transactions/transaction-explorer.server";
import { DashboardOverview } from "./dashboard-overview.server";

export type OperationalConsistencyCheck = {
  code: string;
  label: string;
  ok: boolean;
  expected: string;
  actual: string;
};

export type OperationalConsistencyReport = {
  status: "consistent" | "needs_attention";
  label: string;
  checks: OperationalConsistencyCheck[];
};

export class OperationalDashboardConsistency {
  async getConsistencyReport(workspace: CompanyWorkspace): Promise<OperationalConsistencyReport> {
    const [overview, transactionState, freshness, closingAdjustments, ruleHealth] = await Promise.all([
      new DashboardOverview().getOverview(workspace),
      new TransactionExplorer().summarizeTransactionState(workspace),
      new DocumentFreshnessCenter().getFreshness(workspace),
      new ClosingAdjustmentCenter().summarizeClosingAdjustments(workspace),
      new CorrectionRuleImpactCenter().summarizeRuleHealth(workspace),
    ]);
    const checks: OperationalConsistencyCheck[] = [
      {
        code: "dashboard_review_matches_transactions",
        label: "Transactions à vérifier alignées",
        ok: overview.transactionState.reviewCount === transactionState.review,
        expected: String(transactionState.review),
        actual: String(overview.transactionState.reviewCount),
      },
      {
        code: "dashboard_freshness_matches_documents",
        label: "Documents à régénérer alignés",
        ok: (overview.documentFreshness?.staleCount ?? 0) === freshness.staleCount,
        expected: String(freshness.staleCount),
        actual: String(overview.documentFreshness?.staleCount ?? 0),
      },
      {
        code: "dashboard_closing_matches_adjustments",
        label: "OD brouillon alignées",
        ok: (overview.closingAdjustments?.draft ?? 0) === closingAdjustments.draft,
        expected: String(closingAdjustments.draft),
        actual: String(overview.closingAdjustments?.draft ?? 0),
      },
      {
        code: "rules_are_explainable",
        label: "Règles explicables",
        ok: ruleHealth.broad === 0,
        expected: "0 règle trop large",
        actual: `${ruleHealth.broad} règle${ruleHealth.broad > 1 ? "s" : ""} à surveiller`,
      },
    ];
    const ok = checks.every((check) => check.ok);
    return {
      status: ok ? "consistent" : "needs_attention",
      label: ok ? "Exploitation cohérente" : "Données à revoir",
      checks,
    };
  }

  async assertDashboardMatchesTransactions(workspace: CompanyWorkspace) {
    const report = await this.getConsistencyReport(workspace);
    return report.checks.find((check) => check.code === "dashboard_review_matches_transactions")?.ok === true;
  }

  async getOperationalHealth(workspace: CompanyWorkspace) {
    const report = await this.getConsistencyReport(workspace);
    return {
      status: report.status,
      label: report.label,
      issueCount: report.checks.filter((check) => !check.ok).length,
    };
  }
}

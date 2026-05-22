import { AccountingReviewCenter } from "../accounting-review/accounting-review-center.server";
import { AnnualClosingCenter } from "../annual-closing/annual-closing-center.server";
import { ClosingAdjustmentCenter } from "../closing-adjustments/closing-adjustment-center.server";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { DashboardOverview } from "../dashboard/dashboard-overview.server";
import { DocumentFreshnessCenter } from "../documents/document-freshness-center.server";
import { JournalAuditCenter } from "../journal/journal-audit-center.server";
import type { AccountingChatContext } from "./accounting-chat-provider.server";
import { ChatAnswerGrounding } from "./chat-answer-grounding.server";

export class ChatContextBuilder {
  constructor(
    private readonly dashboard = new DashboardOverview(),
    private readonly accountingReview = new AccountingReviewCenter(),
    private readonly closingAdjustments = new ClosingAdjustmentCenter(),
    private readonly journalAudit = new JournalAuditCenter(),
    private readonly freshness = new DocumentFreshnessCenter(),
    private readonly annualClosing = new AnnualClosingCenter(),
    private readonly grounding = new ChatAnswerGrounding()
  ) {}

  async buildChatContext(workspace: CompanyWorkspace): Promise<AccountingChatContext> {
    const [dashboard, accountingReview, closingAdjustments, journalAudit, documentFreshness, annualClosing] = await Promise.all([
      this.dashboard.getOverview(workspace),
      this.accountingReview.getReview(workspace),
      this.closingAdjustments.summarizeClosingAdjustments(workspace),
      this.journalAudit.getAuditSummary(workspace),
      this.freshness.getFreshness(workspace),
      this.annualClosing.getClosingOverview(workspace),
    ]);
    const baseContext = {
      company: workspace.company.name,
      fiscalYear: `${workspace.fiscalYear.startDate.toISOString().slice(0, 10)} → ${workspace.fiscalYear.endDate.toISOString().slice(0, 10)}`,
      dashboard: compactDashboard(dashboard),
      accountingReview: compactReview(accountingReview),
      closingAdjustments,
      journalAudit: {
        status: journalAudit.status,
        label: journalAudit.label,
        summary: journalAudit.summary,
        issues: journalAudit.issues.slice(0, 5),
      },
      documentFreshness: {
        staleCount: documentFreshness.staleCount,
        documents: documentFreshness.documents.map((document) => ({
          type: document.type,
          filename: document.filename,
          statusLabel: document.statusLabel,
        })),
      },
      annualClosing: {
        status: annualClosing.run.status,
        fiscalYearStatus: annualClosing.fiscalYearStatus,
        canClose: annualClosing.canClose,
        blockers: annualClosing.blockers.slice(0, 5),
        warnings: annualClosing.warnings.slice(0, 5),
      },
    };
    const grounding = this.grounding.buildGrounding(baseContext);
    return {
      contextVersion: grounding.contextVersion,
      references: grounding.references,
      ...baseContext,
    };
  }
}

function compactDashboard(dashboard: Awaited<ReturnType<DashboardOverview["getOverview"]>>) {
  return {
    kpis: dashboard.kpis,
    alerts: dashboard.alerts,
    transactionState: dashboard.transactionState,
    documentFreshness: dashboard.documentFreshness,
    closingAdjustments: dashboard.closingAdjustments,
  };
}

function compactReview(review: Awaited<ReturnType<AccountingReviewCenter["getReview"]>>) {
  return {
    status: review.status,
    blockingCount: review.blockingCount,
    warningCount: review.warningCount,
    controls: review.controls.map((control) => ({
      code: control.code,
      title: control.title,
      severity: control.severity,
      openIssueCount: control.openIssueCount,
      handledIssueCount: control.handledIssueCount,
    })),
  };
}

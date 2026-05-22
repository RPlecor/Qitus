import { ActivityLogCenter } from "../activity-log/activity-log-center.server";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { ExpectedRouteError } from "../route-errors.server";
import { ClosingAdjustmentReviewWorkflow, type ClosingAdjustmentReview } from "../closing-adjustments/closing-adjustment-review-workflow.server";
import { ClosingWorkpaperCenter, type ClosingWorkpaperSummary } from "./closing-workpaper-center.server";
import { buildGeneralClosingDraft, type ClosingAdjustmentDraftBuildResult } from "./general-closing-calculators.server";

export type ClosingWorkpaperReviewFilters = {
  kind?: string | null;
  status?: "DRAFT" | "READY" | "ARCHIVED" | "all" | null;
  missingEvidence?: boolean | null;
  hasProposal?: boolean | null;
};

export type ClosingWorkpaperReview = {
  workpaper: ClosingWorkpaperSummary;
  predictedDraft: ClosingAdjustmentDraftBuildResult | null;
  proposal: ClosingAdjustmentReview | null;
  missingEvidence: boolean;
  hasProposal: boolean;
  actionLabel: string;
};

export type ClosingWorkpaperReadiness = {
  total: number;
  draft: number;
  ready: number;
  archived: number;
  missingEvidence: number;
  withProposal: number;
};

export class ClosingWorkpaperWorkflow {
  constructor(
    private readonly center = new ClosingWorkpaperCenter(),
    private readonly adjustmentReviews = new ClosingAdjustmentReviewWorkflow(),
    private readonly activity = new ActivityLogCenter()
  ) {}

  async getReviewQueue(workspace: CompanyWorkspace, filters: ClosingWorkpaperReviewFilters = {}) {
    const [workpapers, proposals] = await Promise.all([
      this.center.listWorkpapers(workspace, { kind: filters.kind, includeArchived: true }),
      this.adjustmentReviews.getReviewQueue(workspace),
    ]);
    const reviews = workpapers.map((workpaper) => this.buildReview(workpaper, proposals));
    return applyFilters(reviews, filters);
  }

  async getWorkpaperReview(workspace: CompanyWorkspace, workpaperKey: string) {
    const workpaper = await this.center.getWorkpaper(workspace, workpaperKey);
    const proposals = await this.adjustmentReviews.getReviewQueue(workspace);
    return this.buildReview(workpaper, proposals);
  }

  async markReady(workspace: CompanyWorkspace, workpaperKey: string) {
    const workpaper = await this.center.getWorkpaper(workspace, workpaperKey);
    if (workpaper.status === "ARCHIVED") throw new ExpectedRouteError("Un workpaper archivé ne peut pas être marqué prêt.", 409);
    const updated = await this.center.saveWorkpaper(workspace, {
      workpaperKey,
      kind: workpaper.kind,
      title: workpaper.title,
      status: "READY",
      sourceEntityType: workpaper.sourceEntityType,
      sourceEntityId: workpaper.sourceEntityId,
      assumptions: workpaper.assumptions,
      calculation: workpaper.calculation,
      note: workpaper.note,
    });
    await this.activity.recordActivity(workspace, {
      action: "closing_workpaper.marked_ready",
      entityType: "closing_workpaper",
      entityId: workpaperKey,
      metadata: { kind: workpaper.kind, title: workpaper.title },
    });
    return updated;
  }

  async markDraft(workspace: CompanyWorkspace, workpaperKey: string, reason: string) {
    const note = reason.trim();
    if (!note) throw new ExpectedRouteError("Le retour en brouillon exige une raison.", 400);
    const workpaper = await this.center.getWorkpaper(workspace, workpaperKey);
    const updated = await this.center.saveWorkpaper(workspace, {
      workpaperKey,
      kind: workpaper.kind,
      title: workpaper.title,
      status: "DRAFT",
      sourceEntityType: workpaper.sourceEntityType,
      sourceEntityId: workpaper.sourceEntityId,
      assumptions: workpaper.assumptions,
      calculation: workpaper.calculation,
      note,
    });
    await this.activity.recordActivity(workspace, {
      action: "closing_workpaper.marked_draft",
      entityType: "closing_workpaper",
      entityId: workpaperKey,
      metadata: { kind: workpaper.kind, title: workpaper.title, reason: note },
    });
    return updated;
  }

  async getNextWorkpaper(workspace: CompanyWorkspace, workpaperKey: string, filters: ClosingWorkpaperReviewFilters = {}) {
    const queue = await this.getReviewQueue(workspace, filters);
    const index = queue.findIndex((item) => item.workpaper.workpaperKey === workpaperKey);
    if (index === -1) return null;
    return queue[index + 1] ?? null;
  }

  async summarizeWorkpaperReadiness(workspace: CompanyWorkspace): Promise<ClosingWorkpaperReadiness> {
    const reviews = await this.getReviewQueue(workspace, { status: "all" });
    return {
      total: reviews.filter((item) => item.workpaper.status !== "ARCHIVED").length,
      draft: reviews.filter((item) => item.workpaper.status === "DRAFT").length,
      ready: reviews.filter((item) => item.workpaper.status === "READY").length,
      archived: reviews.filter((item) => item.workpaper.status === "ARCHIVED").length,
      missingEvidence: reviews.filter((item) => item.missingEvidence).length,
      withProposal: reviews.filter((item) => item.hasProposal).length,
    };
  }

  private buildReview(workpaper: ClosingWorkpaperSummary, proposals: ClosingAdjustmentReview[]): ClosingWorkpaperReview {
    const predictedDraft = buildGeneralClosingDraft({
      workpaperKey: workpaper.workpaperKey,
      kind: workpaper.kind,
      title: workpaper.title,
      assumptions: workpaper.assumptions,
      calculation: workpaper.calculation,
      sourceEntityType: workpaper.sourceEntityType,
      sourceEntityId: workpaper.sourceEntityId,
    });
    const proposal = predictedDraft ? proposals.find((item) => item.proposal.proposalKey === predictedDraft.proposalKey) ?? null : null;
    return {
      workpaper,
      predictedDraft,
      proposal,
      missingEvidence: proposal?.evidence.missing ?? false,
      hasProposal: Boolean(proposal),
      actionLabel: workpaper.status === "DRAFT"
        ? "Compléter puis marquer prêt"
        : proposal
          ? "Relire la proposition OD"
          : "Générer la proposition OD",
    };
  }
}

function applyFilters(reviews: ClosingWorkpaperReview[], filters: ClosingWorkpaperReviewFilters) {
  return reviews.filter((review) => {
    if (filters.kind && review.workpaper.kind !== filters.kind) return false;
    if (filters.status && filters.status !== "all" && review.workpaper.status !== filters.status) return false;
    if (filters.status !== "ARCHIVED" && filters.status !== "all" && review.workpaper.status === "ARCHIVED") return false;
    if (filters.missingEvidence != null && review.missingEvidence !== filters.missingEvidence) return false;
    if (filters.hasProposal != null && review.hasProposal !== filters.hasProposal) return false;
    return true;
  });
}

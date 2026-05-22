import { Prisma } from "@prisma/client";
import { ActivityLogCenter } from "../activity-log/activity-log-center.server";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { ExpectedRouteError } from "../route-errors.server";
import { ClosingAdjustmentCenter, type ClosingAdjustmentSummary } from "./closing-adjustment-center.server";
import {
  summarizeClosingAdjustmentEvidence,
  type ClosingAdjustmentEvidenceSummary,
} from "./closing-adjustment-evidence.server";
import { ClosingAdjustmentFreshnessCenter, type ClosingAdjustmentFreshness } from "./closing-adjustment-freshness-center.server";

export type ClosingAdjustmentReviewFilters = {
  status?: "DRAFT" | "APPROVED" | "REJECTED" | "all" | null;
  kind?: string | null;
  evidence?: "missing" | "ok" | "all" | null;
  freshness?: "stale" | "fresh" | "all" | null;
};

export type ClosingAdjustmentReview = {
  proposal: ClosingAdjustmentSummary;
  freshness: ClosingAdjustmentFreshness;
  evidence: ClosingAdjustmentEvidenceSummary;
  canApprove: boolean;
  blockingReasons: string[];
};

export type ClosingAdjustmentReadiness = {
  total: number;
  draft: number;
  ready: number;
  stale: number;
  approved: number;
  rejected: number;
  evidenceMissing: number;
};

export class ClosingAdjustmentReviewWorkflow {
  constructor(
    private readonly center = new ClosingAdjustmentCenter(),
    private readonly freshness = new ClosingAdjustmentFreshnessCenter(),
    private readonly activity = new ActivityLogCenter()
  ) {}

  async getReviewQueue(workspace: CompanyWorkspace, filters: ClosingAdjustmentReviewFilters = {}) {
    const proposals = await this.center.listProposals(workspace);
    const reviews = await Promise.all(proposals.map((proposal) => this.reviewForProposal(workspace, proposal)));
    return applyFilters(reviews, filters);
  }

  async getProposalReview(workspace: CompanyWorkspace, proposalKey: string): Promise<ClosingAdjustmentReview> {
    const proposal = await this.center.getProposal(workspace, proposalKey);
    return this.reviewForProposal(workspace, proposal);
  }

  async approveWithEvidenceCheck(workspace: CompanyWorkspace, input: { proposalKey: string }) {
    const review = await this.getProposalReview(workspace, input.proposalKey);
    if (review.evidence.missing) {
      await this.activity.recordActivity(workspace, {
        action: "closing_adjustment.approval_blocked_missing_evidence",
        entityType: "closing_adjustment",
        entityId: review.proposal.proposalKey,
        metadata: { kind: review.proposal.kind, label: review.proposal.label },
      });
      throw new ExpectedRouteError("Une pièce est requise avant de valider cette OD.", 409);
    }
    await this.freshness.assertProposalFresh(workspace, input.proposalKey);
    return this.center.approveProposal(workspace, input.proposalKey);
  }

  async rejectWithNote(workspace: CompanyWorkspace, input: { proposalKey: string; note: string }) {
    const note = input.note.trim();
    if (!note) throw new ExpectedRouteError("Le rejet d'une OD exige une note.", 400);
    return this.center.rejectProposal(workspace, input.proposalKey, note);
  }

  async reopenRejected(workspace: CompanyWorkspace, input: { proposalKey: string; note: string }) {
    const note = input.note.trim();
    if (!note) throw new ExpectedRouteError("La réouverture d'une OD rejetée exige une note.", 400);
    const proposal = await this.center.getProposal(workspace, input.proposalKey);
    if (proposal.status === "APPROVED") throw new ExpectedRouteError("Une OD validée est immuable.", 409);
    if (proposal.status !== "REJECTED") return proposal;
    const row = await prisma.closingAdjustmentProposal.update({
      where: { fiscalYearId_proposalKey: { fiscalYearId: workspace.fiscalYear.id, proposalKey: input.proposalKey } },
      data: {
        status: "DRAFT",
        rejectedAt: null,
        rejectedByUserId: null,
        note,
        staleReason: "OD réouverte après rejet, recalcul recommandé.",
      },
    });
    await prisma.closingAdjustmentEvent.create({
      data: {
        proposalId: row.id,
        eventType: "proposal.reopened",
        createdByUserId: workspace.user.id,
        payloadJson: { note } as Prisma.InputJsonValue,
      },
    });
    await this.activity.recordActivity(workspace, {
      action: "closing_adjustment.reopened",
      entityType: "closing_adjustment",
      entityId: proposal.proposalKey,
      metadata: { kind: proposal.kind, label: proposal.label, note },
    });
    return this.center.getProposal(workspace, input.proposalKey);
  }

  async summarizeAdjustmentReadiness(workspace: CompanyWorkspace): Promise<ClosingAdjustmentReadiness> {
    const reviews = await this.getReviewQueue(workspace);
    return summarizeClosingAdjustmentReviews(reviews);
  }

  async recalculateStale(workspace: CompanyWorkspace) {
    const reviews = await this.getReviewQueue(workspace, { status: "DRAFT", freshness: "stale" });
    const recalculated = [];
    for (const review of reviews) {
      recalculated.push(await this.center.recalculateProposal(workspace, review.proposal.proposalKey));
    }
    await this.activity.recordActivity(workspace, {
      action: "closing_adjustment.recalculated_stale",
      entityType: "closing_adjustment",
      entityId: workspace.fiscalYear.id,
      metadata: { count: recalculated.length },
    });
    return recalculated;
  }

  private async reviewForProposal(workspace: CompanyWorkspace, proposal: ClosingAdjustmentSummary): Promise<ClosingAdjustmentReview> {
    const [freshness, links] = await Promise.all([
      this.freshness.getProposalFreshness(workspace, proposal.proposalKey),
      prisma.attachmentLink.findMany({
        where: {
          attachment: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id, archivedAt: null },
          OR: [
            { entityType: "CLOSING_ADJUSTMENT", entityId: proposal.proposalKey },
            { entityType: "CLOSING_ADJUSTMENT", entityId: proposal.id },
            ...(proposal.journalEntryId ? [{ entityType: "JOURNAL_ENTRY" as const, entityId: proposal.journalEntryId }] : []),
          ],
        },
        include: { attachment: { select: { id: true, originalFilename: true, status: true } } },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    const evidence = summarizeClosingAdjustmentEvidence(proposal, links);
    const blockingReasons = [
      ...(proposal.status !== "DRAFT" ? ["La proposition n'est pas en brouillon."] : []),
      ...(freshness.stale ? freshness.reasons.map((reason) => reason.label) : []),
      ...(evidence.missing ? ["Pièce requise manquante."] : []),
    ];
    return {
      proposal,
      freshness,
      evidence,
      canApprove: proposal.status === "DRAFT" && blockingReasons.length === 0,
      blockingReasons,
    };
  }
}

export function summarizeClosingAdjustmentReviews(reviews: ClosingAdjustmentReview[]): ClosingAdjustmentReadiness {
  return {
    total: reviews.length,
    draft: reviews.filter((review) => review.proposal.status === "DRAFT").length,
    ready: reviews.filter((review) => review.proposal.status === "DRAFT" && review.canApprove).length,
    stale: reviews.filter((review) => review.freshness.stale).length,
    approved: reviews.filter((review) => review.proposal.status === "APPROVED").length,
    rejected: reviews.filter((review) => review.proposal.status === "REJECTED").length,
    evidenceMissing: reviews.filter((review) => review.evidence.missing).length,
  };
}

function applyFilters(reviews: ClosingAdjustmentReview[], filters: ClosingAdjustmentReviewFilters) {
  return reviews.filter((review) => {
    if (filters.status && filters.status !== "all" && review.proposal.status !== filters.status) return false;
    if (filters.kind && review.proposal.kind !== filters.kind) return false;
    if (filters.evidence === "missing" && !review.evidence.missing) return false;
    if (filters.evidence === "ok" && review.evidence.missing) return false;
    if (filters.freshness === "stale" && !review.freshness.stale) return false;
    if (filters.freshness === "fresh" && review.freshness.stale) return false;
    return true;
  });
}

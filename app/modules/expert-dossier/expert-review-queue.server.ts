import type { ExpertReviewItemStatus, ExpertReviewSeverity } from "@prisma/client";
import { ActivityLogCenter } from "../activity-log/activity-log-center.server";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { ExpectedRouteError } from "../route-errors.server";
import { ExpertReviewWorkflow } from "./expert-review-workflow.server";

export type ExpertReviewQueueFilters = {
  status?: ExpertReviewItemStatus | "open" | "all" | null;
  severity?: ExpertReviewSeverity | null;
  sectionCode?: string | null;
};

export class ExpertReviewQueue {
  constructor(
    private readonly workflow = new ExpertReviewWorkflow(),
    private readonly activity = new ActivityLogCenter()
  ) {}

  async getReviewQueue(workspace: CompanyWorkspace, filters: ExpertReviewQueueFilters = {}) {
    const [review, items] = await Promise.all([
      this.workflow.getReview(workspace),
      this.workflow.listReviewItems(workspace, filters),
    ]);
    return {
      review,
      items,
      summary: summarizeItems(items),
    };
  }

  async getItemDetail(workspace: CompanyWorkspace, itemId: string) {
    const item = (await this.workflow.listReviewItems(workspace, { status: "all" })).find((candidate) => candidate.id === itemId);
    if (!item) throw new ExpectedRouteError("Demande de revue introuvable.", 404);
    return item;
  }

  async answerItem(workspace: CompanyWorkspace, input: { itemId: string; body: string }) {
    const body = requireText(input.body, "Une réponse est obligatoire.");
    const item = await findWorkspaceItem(workspace, input.itemId);
    await prisma.expertReviewComment.create({
      data: {
        reviewItemId: item.id,
        authorType: "USER",
        authorName: workspace.user.name ?? workspace.user.email,
        body,
      },
    });
    const updated = await prisma.expertReviewItem.update({
      where: { id: item.id },
      data: { status: item.status === "RESOLVED" || item.status === "WAIVED" ? item.status : "ANSWERED" },
      include: { comments: { orderBy: { createdAt: "asc" } }, reviewRun: true },
    });
    await this.activity.recordActivity(workspace, {
      action: "expert_review.item_answered",
      entityType: "expert_review_item",
      entityId: item.id,
      metadata: { title: item.title },
    });
    return summarizeReviewItem(updated);
  }

  async waiveItem(workspace: CompanyWorkspace, input: { itemId: string; note: string }) {
    const note = requireText(input.note, "Une note est obligatoire pour ignorer une demande.");
    const item = await findWorkspaceItem(workspace, input.itemId);
    await prisma.expertReviewComment.create({
      data: {
        reviewItemId: item.id,
        authorType: "USER",
        authorName: workspace.user.name ?? workspace.user.email,
        body: note,
      },
    });
    const updated = await prisma.expertReviewItem.update({
      where: { id: item.id },
      data: { status: "WAIVED", resolvedAt: new Date() },
      include: { comments: { orderBy: { createdAt: "asc" } }, reviewRun: true },
    });
    await this.activity.recordActivity(workspace, {
      action: "expert_review.item_waived",
      entityType: "expert_review_item",
      entityId: item.id,
      metadata: { title: item.title },
    });
    return summarizeReviewItem(updated);
  }

  async summarizeReviewReadiness(workspace: CompanyWorkspace) {
    const review = await this.workflow.getReview(workspace);
    if (!review) {
      return {
        hasReview: false,
        status: "NO_REVIEW",
        totalItems: 0,
        openItems: 0,
        openBlockingItems: 0,
        answeredItems: 0,
        resolvedItems: 0,
        signedOff: false,
        canSignOff: false,
      };
    }
    const items = await this.workflow.listReviewItems(workspace, { status: "all" });
    const summary = summarizeItems(items);
    return {
      hasReview: true,
      status: review.status,
      totalItems: summary.total,
      openItems: summary.open,
      openBlockingItems: summary.blockingOpen,
      answeredItems: summary.answered,
      resolvedItems: summary.resolved,
      signedOff: review.status === "SIGNED_OFF",
      canSignOff: summary.blockingOpen === 0,
    };
  }
}

async function findWorkspaceItem(workspace: CompanyWorkspace, itemId: string) {
  const item = await prisma.expertReviewItem.findFirst({
    where: { id: itemId, reviewRun: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id } },
  });
  if (!item) throw new ExpectedRouteError("Demande de revue introuvable.", 404);
  return item;
}

function summarizeItems(items: Array<{ status: string; severity: string }>) {
  return {
    total: items.length,
    open: items.filter((item) => item.status === "OPEN" || item.status === "ANSWERED").length,
    answered: items.filter((item) => item.status === "ANSWERED").length,
    resolved: items.filter((item) => item.status === "RESOLVED" || item.status === "WAIVED").length,
    blockingOpen: items.filter((item) => item.severity === "BLOCKING" && (item.status === "OPEN" || item.status === "ANSWERED")).length,
  };
}

function summarizeReviewItem(item: {
  id: string;
  sectionCode: string;
  entityType: string | null;
  entityId: string | null;
  severity: ExpertReviewSeverity;
  status: ExpertReviewItemStatus;
  title: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  comments?: Array<{ id: string; authorType: string; authorName: string; body: string; createdAt: Date }>;
}) {
  return {
    id: item.id,
    sectionCode: item.sectionCode,
    entityType: item.entityType,
    entityId: item.entityId,
    severity: item.severity,
    status: item.status,
    title: item.title,
    body: item.body,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    resolvedAt: item.resolvedAt?.toISOString() ?? null,
    comments: item.comments?.map((comment) => ({
      id: comment.id,
      authorType: comment.authorType,
      authorName: comment.authorName,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
    })) ?? [],
  };
}

function requireText(value: unknown, message: string) {
  const text = String(value ?? "").trim();
  if (!text) throw new ExpectedRouteError(message, 400);
  return text;
}

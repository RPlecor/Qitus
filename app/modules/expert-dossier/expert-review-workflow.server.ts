import { createHash } from "node:crypto";
import type { ExpertReviewAuthorType, ExpertReviewItemStatus, ExpertReviewSeverity, ExpertReviewStatus } from "@prisma/client";
import { ActivityLogCenter } from "../activity-log/activity-log-center.server";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { ExpectedRouteError } from "../route-errors.server";
import { ExpertReviewShareCenter } from "../expert-review/expert-review-share-center.server";

export type ExpertReviewContext =
  | { kind: "workspace"; workspace: CompanyWorkspace }
  | { kind: "shared"; token: string };

export type ExpertReviewFilters = {
  status?: ExpertReviewItemStatus | "open" | "all" | null;
  sectionCode?: string | null;
  severity?: ExpertReviewSeverity | null;
};

export class ExpertReviewWorkflow {
  constructor(
    private readonly activity = new ActivityLogCenter(),
    private readonly shareCenter = new ExpertReviewShareCenter()
  ) {}

  async startReview(workspace: CompanyWorkspace, input: { shareLinkId?: string | null; reviewerName?: string | null; reviewerEmail?: string | null } = {}) {
    const shareLink = input.shareLinkId
      ? await prisma.shareLink.findFirstOrThrow({ where: { id: input.shareLinkId, companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id } })
      : await prisma.shareLink.findFirst({ where: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id, revokedAt: null }, orderBy: { createdAt: "desc" } });
    const run = await prisma.expertReviewRun.create({
      data: {
        companyId: workspace.company.id,
        fiscalYearId: workspace.fiscalYear.id,
        shareLinkId: shareLink?.id ?? null,
        status: "IN_REVIEW",
        submittedAt: new Date(),
        reviewerName: clean(input.reviewerName) ?? shareLink?.reviewerName ?? null,
        reviewerEmail: clean(input.reviewerEmail),
        summaryJson: { startedFrom: "qitus" },
      },
    });
    await this.activity.recordActivity(workspace, {
      action: "expert_review.started",
      entityType: "expert_review_run",
      entityId: run.id,
      metadata: { shareLinkId: shareLink?.id ?? null },
    });
    return this.getReview(workspace, run.id);
  }

  async getReview(workspace: CompanyWorkspace, reviewRunId?: string | null) {
    const run = reviewRunId
      ? await prisma.expertReviewRun.findFirst({ where: { id: reviewRunId, companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id }, include: reviewInclude })
      : await prisma.expertReviewRun.findFirst({ where: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id }, orderBy: { createdAt: "desc" }, include: reviewInclude });
    if (!run) return null;
    return summarizeReviewRun(run);
  }

  async listReviewItems(workspace: CompanyWorkspace, filters: ExpertReviewFilters = {}) {
    const rows = await prisma.expertReviewItem.findMany({
      where: {
        reviewRun: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id },
        status: filters.status && filters.status !== "all" ? filters.status === "open" ? { in: ["OPEN", "ANSWERED"] } : filters.status : undefined,
        sectionCode: clean(filters.sectionCode) ?? undefined,
        severity: filters.severity ?? undefined,
      },
      include: { comments: { orderBy: { createdAt: "asc" } }, reviewRun: true },
      orderBy: [{ status: "asc" }, { severity: "asc" }, { createdAt: "desc" }],
    });
    return rows.map(summarizeReviewItem);
  }

  async createReviewItem(context: ExpertReviewContext, input: {
    reviewRunId?: string | null;
    sectionCode: string;
    title: string;
    body: string;
    severity?: ExpertReviewSeverity | null;
    entityType?: string | null;
    entityId?: string | null;
    authorName?: string | null;
  }) {
    const resolved = await this.resolveContext(context, input.reviewRunId);
    const item = await prisma.expertReviewItem.create({
      data: {
        reviewRunId: resolved.run.id,
        sectionCode: requireText(input.sectionCode, "La section est requise."),
        severity: input.severity ?? "WARNING",
        title: requireText(input.title, "Le titre est requis."),
        body: requireText(input.body, "Le détail est requis."),
        entityType: clean(input.entityType),
        entityId: clean(input.entityId),
        comments: {
          create: {
            authorType: context.kind === "shared" ? "EXPERT" : "USER",
            authorName: clean(input.authorName) ?? defaultAuthorName(context, resolved.workspace),
            body: requireText(input.body, "Le détail est requis."),
          },
        },
      },
      include: { comments: true, reviewRun: true },
    });
    await this.activity.recordActivity(resolved.workspace, {
      action: "expert_review.item_created",
      entityType: "expert_review_item",
      entityId: item.id,
      metadata: { sectionCode: item.sectionCode, severity: item.severity, title: item.title },
    });
    return summarizeReviewItem(item);
  }

  async addComment(context: ExpertReviewContext, input: { itemId: string; body: string; authorName?: string | null }) {
    const resolved = await this.resolveContext(context);
    const item = await prisma.expertReviewItem.findFirst({
      where: { id: input.itemId, reviewRun: { companyId: resolved.workspace.company.id, fiscalYearId: resolved.workspace.fiscalYear.id } },
      include: { reviewRun: true },
    });
    if (!item) throw new ExpectedRouteError("Demande de revue introuvable.", 404);
    const comment = await prisma.expertReviewComment.create({
      data: {
        reviewItemId: item.id,
        authorType: context.kind === "shared" ? "EXPERT" : "USER",
        authorName: clean(input.authorName) ?? defaultAuthorName(context, resolved.workspace),
        body: requireText(input.body, "Le commentaire est requis."),
      },
    });
    const nextStatus: ExpertReviewItemStatus = context.kind === "workspace" && item.status === "OPEN" ? "ANSWERED" : item.status;
    if (nextStatus !== item.status) await prisma.expertReviewItem.update({ where: { id: item.id }, data: { status: nextStatus } });
    await this.activity.recordActivity(resolved.workspace, {
      action: "expert_review.comment_added",
      entityType: "expert_review_item",
      entityId: item.id,
      metadata: { authorType: comment.authorType },
    });
    return comment;
  }

  async resolveReviewItem(workspace: CompanyWorkspace, input: { itemId: string; note?: string | null }) {
    const item = await this.findWorkspaceItem(workspace, input.itemId);
    const note = requireText(input.note, "Une note est obligatoire pour résoudre une demande.");
    await prisma.expertReviewComment.create({
      data: { reviewItemId: item.id, authorType: "USER", authorName: workspace.user.name ?? workspace.user.email, body: note },
    });
    const updated = await prisma.expertReviewItem.update({ where: { id: item.id }, data: { status: "RESOLVED", resolvedAt: new Date() }, include: { comments: true, reviewRun: true } });
    await this.activity.recordActivity(workspace, {
      action: "expert_review.item_resolved",
      entityType: "expert_review_item",
      entityId: item.id,
      metadata: { title: item.title },
    });
    return summarizeReviewItem(updated);
  }

  async reopenReviewItem(workspace: CompanyWorkspace, input: { itemId: string; note?: string | null }) {
    const item = await this.findWorkspaceItem(workspace, input.itemId);
    const note = requireText(input.note, "Une note est obligatoire pour rouvrir une demande.");
    await prisma.expertReviewComment.create({
      data: { reviewItemId: item.id, authorType: "USER", authorName: workspace.user.name ?? workspace.user.email, body: note },
    });
    const updated = await prisma.expertReviewItem.update({ where: { id: item.id }, data: { status: "OPEN", resolvedAt: null }, include: { comments: true, reviewRun: true } });
    await this.activity.recordActivity(workspace, {
      action: "expert_review.item_reopened",
      entityType: "expert_review_item",
      entityId: item.id,
      metadata: { title: item.title },
    });
    return summarizeReviewItem(updated);
  }

  async requestChanges(token: string, input: { note: string; reviewerName?: string | null }) {
    const resolved = await this.resolveContext({ kind: "shared", token });
    const run = await prisma.expertReviewRun.update({
      where: { id: resolved.run.id },
      data: {
        status: "CHANGES_REQUESTED",
        reviewerName: clean(input.reviewerName) ?? resolved.run.reviewerName,
        summaryJson: { requestChangesNote: requireText(input.note, "Une note est obligatoire pour demander des changements.") },
      },
    });
    await this.activity.recordActivity(resolved.workspace, {
      action: "expert_review.changes_requested",
      entityType: "expert_review_run",
      entityId: run.id,
      metadata: { reviewerName: run.reviewerName },
    });
    return run;
  }

  async recordFinalSignoff(token: string, input: { reviewerName: string; reviewerEmail?: string | null; reviewNote?: string | null }) {
    const resolved = await this.resolveContext({ kind: "shared", token });
    const openBlocking = await prisma.expertReviewItem.count({ where: { reviewRunId: resolved.run.id, severity: "BLOCKING", status: { in: ["OPEN", "ANSWERED"] } } });
    if (openBlocking > 0) throw new ExpectedRouteError("Impossible de signer : des demandes bloquantes restent ouvertes.", 409);
    await this.shareCenter.recordExpertValidation(token, { reviewerName: input.reviewerName, reviewNote: input.reviewNote });
    const run = await prisma.expertReviewRun.update({
      where: { id: resolved.run.id },
      data: {
        status: "SIGNED_OFF",
        signedOffAt: new Date(),
        reviewerName: requireText(input.reviewerName, "Le nom de l'expert-comptable est requis."),
        reviewerEmail: clean(input.reviewerEmail),
        summaryJson: { finalSignoffNote: clean(input.reviewNote) },
      },
    });
    await this.activity.recordActivity(resolved.workspace, {
      action: "expert_review.final_signed_off",
      entityType: "expert_review_run",
      entityId: run.id,
      metadata: { reviewerName: run.reviewerName, reviewerEmail: run.reviewerEmail },
    });
    return run;
  }

  private async resolveContext(context: ExpertReviewContext, requestedRunId?: string | null) {
    if (context.kind === "workspace") {
      const run = requestedRunId
        ? await prisma.expertReviewRun.findFirst({ where: { id: requestedRunId, companyId: context.workspace.company.id, fiscalYearId: context.workspace.fiscalYear.id } })
        : await prisma.expertReviewRun.findFirst({ where: { companyId: context.workspace.company.id, fiscalYearId: context.workspace.fiscalYear.id }, orderBy: { createdAt: "desc" } });
      if (!run) throw new ExpectedRouteError("Aucune revue expert-comptable active.", 404);
      return { workspace: context.workspace, run };
    }
    const shareLink = await prisma.shareLink.findUnique({ where: { tokenHash: hashToken(context.token) } });
    if (!shareLink || shareLink.revokedAt || shareLink.expiresAt.getTime() < Date.now()) throw new ExpectedRouteError("Lien de revue invalide.", 410);
    const shared = await this.shareCenter.getSharedReview(context.token);
    const run = requestedRunId
      ? await prisma.expertReviewRun.findFirst({ where: { id: requestedRunId, shareLinkId: shareLink.id } })
      : await prisma.expertReviewRun.findFirst({ where: { shareLinkId: shareLink.id }, orderBy: { createdAt: "desc" } });
    if (!run) throw new ExpectedRouteError("Aucune revue expert-comptable active pour ce lien.", 404);
    return { workspace: shared.workspace, run };
  }

  private async findWorkspaceItem(workspace: CompanyWorkspace, itemId: string) {
    const item = await prisma.expertReviewItem.findFirst({
      where: { id: itemId, reviewRun: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id } },
    });
    if (!item) throw new ExpectedRouteError("Demande de revue introuvable.", 404);
    return item;
  }
}

const reviewInclude = {
  shareLink: true,
  items: { include: { comments: { orderBy: { createdAt: "asc" as const } } }, orderBy: { createdAt: "desc" as const } },
};

function summarizeReviewRun(run: {
  id: string;
  status: ExpertReviewStatus;
  reviewerName: string | null;
  reviewerEmail: string | null;
  shareLinkId: string | null;
  submittedAt: Date | null;
  signedOffAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  items?: Array<Parameters<typeof summarizeReviewItem>[0]>;
}) {
  const items = run.items?.map(summarizeReviewItem) ?? [];
  return {
    id: run.id,
    status: run.status,
    reviewerName: run.reviewerName,
    reviewerEmail: run.reviewerEmail,
    shareLinkId: run.shareLinkId,
    submittedAt: run.submittedAt?.toISOString() ?? null,
    signedOffAt: run.signedOffAt?.toISOString() ?? null,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
    items,
    summary: {
      total: items.length,
      open: items.filter((item) => item.status === "OPEN" || item.status === "ANSWERED").length,
      blocking: items.filter((item) => item.severity === "BLOCKING" && (item.status === "OPEN" || item.status === "ANSWERED")).length,
      resolved: items.filter((item) => item.status === "RESOLVED" || item.status === "WAIVED").length,
    },
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
  comments?: Array<{ id: string; authorType: ExpertReviewAuthorType; authorName: string; body: string; createdAt: Date }>;
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

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function clean(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function requireText(value: unknown, message: string) {
  const text = clean(value);
  if (!text) throw new ExpectedRouteError(message, 400);
  return text;
}

function defaultAuthorName(context: ExpertReviewContext, workspace: CompanyWorkspace) {
  if (context.kind === "shared") return "Expert-comptable";
  return workspace.user.name ?? workspace.user.email;
}

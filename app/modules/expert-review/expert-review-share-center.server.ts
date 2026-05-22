import { createHash, randomBytes } from "node:crypto";
import type { BankAccount, Company, FiscalYear, ShareLink, User } from "@prisma/client";
import { ActivityLogCenter } from "../activity-log/activity-log-center.server";
import { AnnualClosingCenter } from "../annual-closing/annual-closing-center.server";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { DashboardOverview } from "../dashboard/dashboard-overview.server";
import { prisma } from "../db.server";
import { DocumentCatalog } from "../documents/document-catalog.server";
import { DocumentEvidenceBundle } from "../documents/document-evidence-bundle.server";
import { JournalAuditCenter } from "../journal/journal-audit-center.server";
import { JournalExplorer } from "../journal/journal-explorer.server";
import { ExpectedRouteError } from "../route-errors.server";

export type CreatedShareLink = {
  id: string;
  label: string;
  token: string;
  url: string;
  expiresAt: string;
};

export class ExpertReviewShareCenter {
  constructor(
    private readonly activity = new ActivityLogCenter(),
    private readonly dashboard = new DashboardOverview(),
    private readonly journal = new JournalExplorer(),
    private readonly journalAudit = new JournalAuditCenter(),
    private readonly documents = new DocumentCatalog(),
    private readonly closing = new AnnualClosingCenter(),
    private readonly evidence = new DocumentEvidenceBundle()
  ) {}

  async createShareLink(workspace: CompanyWorkspace, input: { label?: string | null; expiresInDays?: number | null }): Promise<CreatedShareLink> {
    const token = randomBytes(32).toString("base64url");
    const expiresInDays = Math.max(1, Math.min(90, input.expiresInDays ?? 30));
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
    const shareLink = await prisma.shareLink.create({
      data: {
        companyId: workspace.company.id,
        fiscalYearId: workspace.fiscalYear.id,
        tokenHash: hashToken(token),
        label: input.label?.trim() || "Revue expert-comptable",
        expiresAt,
      },
    });
    await this.activity.recordActivity(workspace, {
      action: "expert_review.share_created",
      entityType: "share_link",
      entityId: shareLink.id,
      metadata: { label: shareLink.label, expiresAt: expiresAt.toISOString() },
    });
    return { id: shareLink.id, label: shareLink.label, token, url: `/shared/${token}`, expiresAt: expiresAt.toISOString() };
  }

  async listShareLinks(workspace: CompanyWorkspace) {
    return prisma.shareLink.findMany({
      where: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id },
      orderBy: { createdAt: "desc" },
    }).then((rows) => rows.map(summarizeShareLink));
  }

  async revokeShareLink(workspace: CompanyWorkspace, shareLinkId: string) {
    const shareLink = await prisma.shareLink.findFirstOrThrow({
      where: { id: shareLinkId, companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id },
    });
    const updated = await prisma.shareLink.update({ where: { id: shareLink.id }, data: { revokedAt: new Date() } });
    await this.activity.recordActivity(workspace, {
      action: "expert_review.share_revoked",
      entityType: "share_link",
      entityId: shareLink.id,
      metadata: { label: shareLink.label },
    });
    return summarizeShareLink(updated);
  }

  async getSharedReview(token: string) {
    const { shareLink, workspace } = await this.resolveToken(token);
    await prisma.shareLink.update({ where: { id: shareLink.id }, data: { lastAccessedAt: new Date() } });
    const [overview, journalSummary, journalAudit, documents, closing, manifest] = await Promise.all([
      this.dashboard.getOverview(workspace),
      this.journal.summarizeJournal(workspace),
      this.journalAudit.getAuditSummary(workspace),
      this.documents.listDocuments(workspace),
      this.closing.getClosingOverview(workspace),
      this.evidence.getBundleManifest(workspace).catch(() => null),
    ]);
    return { shareLink: summarizeShareLink(shareLink), workspace, overview, journalSummary, journalAudit, documents, closing, manifest };
  }

  async recordExpertValidation(token: string, input: { reviewerName: string; reviewNote?: string | null }) {
    const { shareLink, workspace } = await this.resolveToken(token);
    const reviewerName = input.reviewerName.trim();
    if (!reviewerName) throw new ExpectedRouteError("Le nom de l'expert-comptable est requis.", 400);
    const updated = await prisma.shareLink.update({
      where: { id: shareLink.id },
      data: { reviewerName, reviewNote: input.reviewNote?.trim() || null, reviewedAt: new Date(), lastAccessedAt: new Date() },
    });
    await this.activity.recordActivity(workspace, {
      action: "expert_review.validated",
      entityType: "share_link",
      entityId: shareLink.id,
      metadata: { reviewerName, reviewNote: input.reviewNote ?? null },
    });
    return summarizeShareLink(updated);
  }

  async getLatestValidation(workspace: CompanyWorkspace) {
    const row = await prisma.shareLink.findFirst({
      where: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id, reviewedAt: { not: null } },
      orderBy: { reviewedAt: "desc" },
    });
    return row ? summarizeShareLink(row) : null;
  }

  private async resolveToken(token: string): Promise<{ shareLink: ShareLink; workspace: CompanyWorkspace }> {
    const shareLink = await prisma.shareLink.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!shareLink) throw new ExpectedRouteError("Lien de revue introuvable.", 404);
    if (shareLink.revokedAt) throw new ExpectedRouteError("Lien de revue révoqué.", 410);
    if (shareLink.expiresAt.getTime() < Date.now()) throw new ExpectedRouteError("Lien de revue expiré.", 410);

    const company = await prisma.company.findUniqueOrThrow({
      where: { id: shareLink.companyId },
      include: { user: true, fiscalYears: true, bankAccounts: true },
    });
    const fiscalYear = company.fiscalYears.find((candidate) => candidate.id === shareLink.fiscalYearId);
    const bankAccount = company.bankAccounts[0];
    if (!fiscalYear || !bankAccount) throw new ExpectedRouteError("Dossier partagé incomplet.", 404);
    return { shareLink, workspace: toWorkspace(company.user, company, fiscalYear, bankAccount) };
  }
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function summarizeShareLink(row: ShareLink) {
  return {
    id: row.id,
    label: row.label,
    permission: row.permission,
    expiresAt: row.expiresAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString() ?? null,
    reviewerName: row.reviewerName,
    reviewNote: row.reviewNote,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    lastAccessedAt: row.lastAccessedAt?.toISOString() ?? null,
  };
}

function toWorkspace(
  user: User,
  company: Company & { fiscalYears: FiscalYear[]; bankAccounts: BankAccount[] },
  fiscalYear: FiscalYear,
  bankAccount: BankAccount
): CompanyWorkspace {
  return {
    user,
    company,
    fiscalYear,
    bankAccount,
    subscription: {
      id: null,
      tier: "SOLO",
      status: "ACTIVE_STUB",
      provider: "NONE",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      limits: { requestsPerMinute: 60, aiCallsPerMonth: 100, importsPerMonth: 5 },
    },
    authMode: "dev",
  };
}

import type { AttachmentLink } from "@prisma/client";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { ExpectedRouteError } from "../route-errors.server";
import { LocalEvidenceStorageAdapter, type EvidenceStorageAdapter } from "./evidence-storage-adapter.server";

export type BrokenAttachmentLink = {
  id: string;
  attachmentId: string;
  entityType: string;
  entityId: string;
  relationType: string;
  reason: string;
};

export type MissingStoredEvidenceFile = {
  attachmentId: string;
  filename: string;
  storageKey: string;
};

export class EvidenceAuditCenter {
  constructor(private readonly storage: EvidenceStorageAdapter = new LocalEvidenceStorageAdapter()) {}

  async getEvidenceAudit(workspace: CompanyWorkspace) {
    const [brokenLinks, missingStoredFiles] = await Promise.all([
      this.listBrokenAttachmentLinks(workspace),
      this.listMissingStoredFiles(workspace),
    ]);
    return {
      status: brokenLinks.length > 0 || missingStoredFiles.length > 0 ? "needs_attention" : "ready",
      brokenLinks,
      missingStoredFiles,
      summary: {
        brokenLinks: brokenLinks.length,
        missingStoredFiles: missingStoredFiles.length,
      },
      bundleBuildable: missingStoredFiles.length === 0,
    };
  }

  async listBrokenAttachmentLinks(workspace: CompanyWorkspace): Promise<BrokenAttachmentLink[]> {
    const links = await prisma.attachmentLink.findMany({
      where: { attachment: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id, archivedAt: null } },
      include: { attachment: true },
      orderBy: { createdAt: "asc" },
    });
    const checks = await Promise.all(links.map((link) => this.linkIssue(workspace, link)));
    return checks.filter((issue): issue is BrokenAttachmentLink => Boolean(issue));
  }

  async listMissingStoredFiles(workspace: CompanyWorkspace): Promise<MissingStoredEvidenceFile[]> {
    const attachments = await prisma.attachment.findMany({
      where: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id, archivedAt: null },
      orderBy: { createdAt: "asc" },
    });
    const checks = await Promise.all(attachments.map(async (attachment) => ({
      attachment,
      exists: await this.storage.exists(attachment.storageKey),
    })));
    return checks.flatMap(({ attachment, exists }) => exists ? [] : [{
      attachmentId: attachment.id,
      filename: attachment.originalFilename,
      storageKey: attachment.storageKey,
    }]);
  }

  async assertEvidenceBundleIsBuildable(workspace: CompanyWorkspace) {
    const audit = await this.getEvidenceAudit(workspace);
    if (audit.missingStoredFiles.length > 0) {
      throw new ExpectedRouteError(`${audit.missingStoredFiles.length} fichier(s) de pièce manquent dans le stockage local.`, 409);
    }
    return audit;
  }

  private async linkIssue(workspace: CompanyWorkspace, link: AttachmentLink): Promise<BrokenAttachmentLink | null> {
    const count = await this.targetCount(workspace, link);
    if (count > 0) return null;
    return {
      id: link.id,
      attachmentId: link.attachmentId,
      entityType: link.entityType,
      entityId: link.entityId,
      relationType: link.relationType,
      reason: "La cible comptable du rattachement n'existe plus dans cet exercice.",
    };
  }

  private async targetCount(workspace: CompanyWorkspace, link: AttachmentLink) {
    if (link.entityType === "TRANSACTION") {
      return prisma.transaction.count({ where: { id: link.entityId, fiscalYearId: workspace.fiscalYear.id } });
    }
    if (link.entityType === "JOURNAL_ENTRY") {
      return prisma.journalEntry.count({ where: { id: link.entityId, fiscalYearId: workspace.fiscalYear.id } });
    }
    if (link.entityType === "CLOSING_ADJUSTMENT") {
      return prisma.closingAdjustmentProposal.count({ where: { proposalKey: link.entityId, fiscalYearId: workspace.fiscalYear.id } });
    }
    return link.entityType === "FISCAL_YEAR" && link.entityId === workspace.fiscalYear.id ? 1 : 0;
  }
}

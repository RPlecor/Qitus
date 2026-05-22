import type { AttachmentEntityType, AttachmentRelationType } from "@prisma/client";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { ExpectedRouteError } from "../route-errors.server";
import { ActivityLogCenter } from "../activity-log/activity-log-center.server";

export type AttachmentLinkInput = {
  attachmentId: string;
  entityType: AttachmentEntityType;
  entityId: string;
  relationType: AttachmentRelationType;
  note?: string | null;
};

export type AttachmentEntityInput = {
  entityType: AttachmentEntityType;
  entityId: string;
};

export class AttachmentLinkCenter {
  constructor(private readonly activity = new ActivityLogCenter()) {}

  async linkAttachment(workspace: CompanyWorkspace, input: AttachmentLinkInput) {
    const attachment = await prisma.attachment.findFirst({
      where: { id: input.attachmentId, companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id, archivedAt: null },
    });
    if (!attachment) throw new ExpectedRouteError("Pièce introuvable.", 404);
    await this.assertEntityBelongsToWorkspace(workspace, input);
    const link = await prisma.attachmentLink.upsert({
      where: {
        attachmentId_entityType_entityId_relationType: {
          attachmentId: input.attachmentId,
          entityType: input.entityType,
          entityId: input.entityId,
          relationType: input.relationType,
        },
      },
      create: {
        attachmentId: input.attachmentId,
        entityType: input.entityType,
        entityId: input.entityId,
        relationType: input.relationType,
        note: input.note || null,
        createdByUserId: workspace.user.id,
      },
      update: { note: input.note || null },
    });
    await this.activity.recordActivity(workspace, {
      action: "attachment.linked",
      entityType: "attachment",
      entityId: attachment.id,
      metadata: { filename: attachment.originalFilename, targetType: input.entityType, targetId: input.entityId, relationType: input.relationType },
    });
    return summarizeLink(link);
  }

  async unlinkAttachment(workspace: CompanyWorkspace, linkId: string) {
    const link = await prisma.attachmentLink.findFirst({
      where: { id: linkId, attachment: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id } },
      include: { attachment: true },
    });
    if (!link) throw new ExpectedRouteError("Lien de pièce introuvable.", 404);
    await prisma.attachmentLink.delete({ where: { id: link.id } });
    await this.activity.recordActivity(workspace, {
      action: "attachment.unlinked",
      entityType: "attachment",
      entityId: link.attachmentId,
      metadata: { filename: link.attachment.originalFilename, targetType: link.entityType, targetId: link.entityId, relationType: link.relationType },
    });
  }

  async listLinksForEntity(workspace: CompanyWorkspace, entity: AttachmentEntityInput) {
    await this.assertEntityBelongsToWorkspace(workspace, { ...entity, attachmentId: "", relationType: "OTHER" });
    const links = await prisma.attachmentLink.findMany({
      where: {
        entityType: entity.entityType,
        entityId: entity.entityId,
        attachment: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id, archivedAt: null },
      },
      include: { attachment: true },
      orderBy: { createdAt: "desc" },
    });
    return links.map((link) => ({
      ...summarizeLink(link),
      attachment: {
        id: link.attachment.id,
        filename: link.attachment.originalFilename,
        status: link.attachment.status,
        supplierName: link.attachment.supplierName,
        amountTtc: link.attachment.amountTtc?.toString() ?? null,
      },
    }));
  }

  async listOrphanAttachments(workspace: CompanyWorkspace) {
    const rows = await prisma.attachment.findMany({
      where: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id, archivedAt: null, links: { none: {} } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((attachment) => ({
      id: attachment.id,
      filename: attachment.originalFilename,
      status: attachment.status,
      createdAt: attachment.createdAt.toISOString(),
      amountTtc: attachment.amountTtc?.toString() ?? null,
    }));
  }

  private async assertEntityBelongsToWorkspace(workspace: CompanyWorkspace, input: AttachmentLinkInput | AttachmentEntityInput) {
    if (input.entityType === "TRANSACTION") {
      const count = await prisma.transaction.count({ where: { id: input.entityId, fiscalYearId: workspace.fiscalYear.id } });
      if (count === 0) throw new ExpectedRouteError("Transaction cible introuvable.", 404);
      return;
    }
    if (input.entityType === "JOURNAL_ENTRY") {
      const count = await prisma.journalEntry.count({ where: { id: input.entityId, fiscalYearId: workspace.fiscalYear.id } });
      if (count === 0) throw new ExpectedRouteError("Écriture cible introuvable.", 404);
      return;
    }
    if (input.entityType === "CLOSING_ADJUSTMENT") {
      const count = await prisma.closingAdjustmentProposal.count({ where: { proposalKey: input.entityId, fiscalYearId: workspace.fiscalYear.id } });
      if (count === 0) throw new ExpectedRouteError("OD cible introuvable.", 404);
      return;
    }
    if (input.entityType === "FISCAL_YEAR" && input.entityId !== workspace.fiscalYear.id) {
      throw new ExpectedRouteError("Exercice cible introuvable.", 404);
    }
    if (input.entityType === "E_INVOICE") {
      const count = await prisma.eInvoice.count({ where: { id: input.entityId, fiscalYearId: workspace.fiscalYear.id } });
      if (count === 0) throw new ExpectedRouteError("Facture électronique cible introuvable.", 404);
    }
  }
}

function summarizeLink(link: {
  id: string;
  attachmentId: string;
  entityType: string;
  entityId: string;
  relationType: string;
  note: string | null;
  createdAt: Date;
}) {
  return {
    id: link.id,
    attachmentId: link.attachmentId,
    entityType: link.entityType,
    entityId: link.entityId,
    relationType: link.relationType,
    note: link.note,
    createdAt: link.createdAt.toISOString(),
  };
}

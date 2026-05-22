import { type DocumentType } from "@prisma/client";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";

export type DocumentFreshnessReason = {
  code: "import_completed" | "transaction_corrected" | "journal_entry_updated" | "closing_adjustment_approved";
  label: string;
  at: string;
};

export type DocumentFreshnessSummary = {
  documentId: string;
  type: DocumentType;
  filename: string;
  generatedAt: string;
  isStale: boolean;
  statusLabel: "À jour" | "À régénérer";
  reasons: DocumentFreshnessReason[];
};

export type DocumentFreshnessState = {
  staleCount: number;
  newestBusinessEventAt: string | null;
  reasons: DocumentFreshnessReason[];
  documents: DocumentFreshnessSummary[];
};

type FreshnessDocument = {
  id: string;
  type: DocumentType;
  filename: string;
  generatedAt: Date;
};

export class DocumentFreshnessCenter {
  async getFreshness(workspace: CompanyWorkspace): Promise<DocumentFreshnessState> {
    const [documents, reasons] = await Promise.all([
      prisma.document.findMany({
        where: { fiscalYearId: workspace.fiscalYear.id },
        orderBy: { generatedAt: "desc" },
      }),
      this.getStaleReasons(workspace),
    ]);
    return buildDocumentFreshness(documents, reasons);
  }

  async getDocumentFreshness(workspace: CompanyWorkspace, documentId: string): Promise<DocumentFreshnessSummary> {
    const freshness = await this.getFreshness(workspace);
    const document = freshness.documents.find((candidate) => candidate.documentId === documentId);
    if (!document) throw new Error("Document introuvable dans cet exercice.");
    return document;
  }

  async getStaleReasons(workspace: CompanyWorkspace): Promise<DocumentFreshnessReason[]> {
    const [lastImport, lastCategorization, lastEntry, lastClosingAdjustment] = await Promise.all([
      prisma.import.findFirst({
        where: { fiscalYearId: workspace.fiscalYear.id, completedAt: { not: null } },
        orderBy: { completedAt: "desc" },
        select: { completedAt: true, originalFilename: true },
      }),
      prisma.categorization.findFirst({
        where: { fiscalYearId: workspace.fiscalYear.id, status: { in: ["USER_CONFIRMED", "USER_CORRECTED", "MANUAL"] } },
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true },
      }),
      prisma.journalEntry.findFirst({
        where: { fiscalYearId: workspace.fiscalYear.id },
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true, journal: true, label: true },
      }),
      prisma.closingAdjustmentProposal.findFirst({
        where: { fiscalYearId: workspace.fiscalYear.id, status: "APPROVED", approvedAt: { not: null } },
        orderBy: { approvedAt: "desc" },
        select: { approvedAt: true, label: true },
      }),
    ]);
    return [
      lastImport?.completedAt ? {
        code: "import_completed" as const,
        label: `Dernier import terminé${lastImport.originalFilename ? ` : ${lastImport.originalFilename}` : ""}`,
        at: lastImport.completedAt.toISOString(),
      } : null,
      lastCategorization ? {
        code: "transaction_corrected" as const,
        label: "Dernière correction transaction",
        at: lastCategorization.updatedAt.toISOString(),
      } : null,
      lastEntry ? {
        code: "journal_entry_updated" as const,
        label: `Dernière écriture ${lastEntry.journal}${lastEntry.label ? ` : ${lastEntry.label}` : ""}`,
        at: lastEntry.updatedAt.toISOString(),
      } : null,
      lastClosingAdjustment?.approvedAt ? {
        code: "closing_adjustment_approved" as const,
        label: `Dernière OD validée : ${lastClosingAdjustment.label}`,
        at: lastClosingAdjustment.approvedAt.toISOString(),
      } : null,
    ].filter((reason): reason is DocumentFreshnessReason => Boolean(reason));
  }
}

export function buildDocumentFreshness(
  documents: FreshnessDocument[],
  reasons: DocumentFreshnessReason[]
): DocumentFreshnessState {
  const newestBusinessEventAt = newestReasonDate(reasons);
  const summaries = documents.map((document) => {
    const staleReasons = reasons.filter((reason) => document.generatedAt < new Date(reason.at));
    return {
      documentId: document.id,
      type: document.type,
      filename: document.filename,
      generatedAt: document.generatedAt.toISOString(),
      isStale: staleReasons.length > 0,
      statusLabel: staleReasons.length > 0 ? "À régénérer" as const : "À jour" as const,
      reasons: staleReasons,
    };
  });
  return {
    staleCount: summaries.filter((document) => document.isStale).length,
    newestBusinessEventAt,
    reasons,
    documents: summaries,
  };
}

function newestReasonDate(reasons: DocumentFreshnessReason[]) {
  const newest = reasons.reduce<Date | null>((current, reason) => {
    const next = new Date(reason.at);
    return !current || next > current ? next : current;
  }, null);
  return newest?.toISOString() ?? null;
}

import { Prisma, type DossierSnapshotStatus } from "@prisma/client";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { ExpectedRouteError } from "../route-errors.server";

export type DossierSnapshotFreshness = {
  snapshotId: string;
  isStale: boolean;
  statusLabel: "À jour" | "Obsolète";
  newestChangeAt: string | null;
  reasons: Array<{ code: string; label: string; at: string }>;
};

export class DossierSnapshotCenter {
  async createSnapshot(workspace: CompanyWorkspace, input: {
    reviewRunId?: string | null;
    status?: DossierSnapshotStatus;
    manifest: unknown;
  }) {
    const status = input.status ?? "DRAFT";
    const snapshotKey = `${status.toLowerCase()}-${new Date().toISOString().replace(/[:.]/g, "-")}`;
    const snapshot = await prisma.dossierSnapshot.create({
      data: {
        companyId: workspace.company.id,
        fiscalYearId: workspace.fiscalYear.id,
        reviewRunId: input.reviewRunId ?? null,
        snapshotKey,
        status,
        manifestJson: input.manifest as Prisma.InputJsonValue,
        createdByUserId: workspace.user.id,
      },
    });
    return summarizeSnapshot(snapshot);
  }

  async getLatestSnapshot(workspace: CompanyWorkspace) {
    const snapshot = await prisma.dossierSnapshot.findFirst({
      where: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id },
      orderBy: { createdAt: "desc" },
    });
    return snapshot ? summarizeSnapshot(snapshot) : null;
  }

  async getSnapshotFreshness(workspace: CompanyWorkspace, snapshotId: string): Promise<DossierSnapshotFreshness> {
    const snapshot = await prisma.dossierSnapshot.findFirstOrThrow({
      where: { id: snapshotId, companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id },
    });
    const reasons = await this.getChangeReasons(workspace);
    const staleReasons = reasons.filter((reason) => new Date(reason.at) > snapshot.createdAt);
    return {
      snapshotId: snapshot.id,
      isStale: staleReasons.length > 0,
      statusLabel: staleReasons.length > 0 ? "Obsolète" : "À jour",
      newestChangeAt: newest(staleReasons),
      reasons: staleReasons,
    };
  }

  async assertSnapshotFresh(workspace: CompanyWorkspace, snapshotId: string) {
    const freshness = await this.getSnapshotFreshness(workspace, snapshotId);
    if (freshness.isStale) throw new ExpectedRouteError("Le dossier transmis est obsolète : prépare un nouveau snapshot.", 409);
    return freshness;
  }

  async getStaleReasons(workspace: CompanyWorkspace) {
    return this.getChangeReasons(workspace);
  }

  private async getChangeReasons(workspace: CompanyWorkspace) {
    const [importRow, categorization, entry, document, attachment, reconciliation, workpaper, closing, vatDeclaration] = await Promise.all([
      prisma.import.findFirst({ where: { fiscalYearId: workspace.fiscalYear.id, completedAt: { not: null } }, orderBy: { completedAt: "desc" }, select: { completedAt: true, originalFilename: true } }),
      prisma.categorization.findFirst({ where: { fiscalYearId: workspace.fiscalYear.id }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
      prisma.journalEntry.findFirst({ where: { fiscalYearId: workspace.fiscalYear.id }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true, label: true } }),
      prisma.document.findFirst({ where: { fiscalYearId: workspace.fiscalYear.id }, orderBy: { generatedAt: "desc" }, select: { generatedAt: true, type: true } }),
      prisma.attachment.findFirst({ where: { fiscalYearId: workspace.fiscalYear.id }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true, originalFilename: true } }),
      prisma.reconciliationRun.findFirst({ where: { fiscalYearId: workspace.fiscalYear.id }, orderBy: { startedAt: "desc" }, select: { startedAt: true, kind: true } }),
      prisma.closingWorkpaper.findFirst({ where: { fiscalYearId: workspace.fiscalYear.id }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true, title: true } }),
      prisma.annualClosingRun.findFirst({ where: { fiscalYearId: workspace.fiscalYear.id }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true, status: true } }),
      prisma.vatDeclaration.findFirst({ where: { fiscalYearId: workspace.fiscalYear.id }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true, type: true } }),
    ]);
    return [
      importRow?.completedAt ? reason("import_completed", `Import terminé${importRow.originalFilename ? ` : ${importRow.originalFilename}` : ""}`, importRow.completedAt) : null,
      categorization ? reason("transaction_updated", "Catégorisation ou correction transaction modifiée", categorization.updatedAt) : null,
      entry ? reason("journal_updated", `Journal modifié${entry.label ? ` : ${entry.label}` : ""}`, entry.updatedAt) : null,
      document ? reason("document_generated", `Document généré : ${document.type}`, document.generatedAt) : null,
      attachment ? reason("attachment_updated", `Pièce modifiée : ${attachment.originalFilename}`, attachment.updatedAt) : null,
      reconciliation?.startedAt ? reason("reconciliation_run", `Rapprochement relancé : ${reconciliation.kind}`, reconciliation.startedAt) : null,
      workpaper ? reason("workpaper_updated", `Feuille de travail modifiée : ${workpaper.title}`, workpaper.updatedAt) : null,
      closing ? reason("annual_closing_updated", `Clôture modifiée : ${closing.status}`, closing.updatedAt) : null,
      vatDeclaration ? reason("vat_declaration_updated", `Déclaration TVA modifiée : ${vatDeclaration.type}`, vatDeclaration.updatedAt) : null,
    ].filter((item): item is { code: string; label: string; at: string } => Boolean(item));
  }
}

function summarizeSnapshot(snapshot: { id: string; snapshotKey: string; status: DossierSnapshotStatus; reviewRunId: string | null; createdAt: Date; manifestJson: unknown }) {
  return {
    id: snapshot.id,
    snapshotKey: snapshot.snapshotKey,
    status: snapshot.status,
    reviewRunId: snapshot.reviewRunId,
    createdAt: snapshot.createdAt.toISOString(),
    manifest: snapshot.manifestJson,
  };
}

function reason(code: string, label: string, at: Date) {
  return { code, label, at: at.toISOString() };
}

function newest(reasons: Array<{ at: string }>) {
  return reasons.reduce<string | null>((current, reason) => (!current || reason.at > current ? reason.at : current), null);
}

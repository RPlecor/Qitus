import type { DossierSnapshotStatus } from "@prisma/client";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { ExpectedRouteError } from "../route-errors.server";
import { DossierSnapshotCenter, type DossierSnapshotFreshness } from "./dossier-snapshot-center.server";
import { ExpertDossierCenter, type ExpertDossierSection } from "./expert-dossier-center.server";

export type DossierSnapshotSummary = {
  id: string;
  snapshotKey: string;
  status: DossierSnapshotStatus;
  reviewRunId: string | null;
  createdAt: string;
  manifest: unknown;
};

export type DossierSnapshotWithFreshness = DossierSnapshotSummary & {
  freshness: DossierSnapshotFreshness;
};

export class DossierSnapshotReviewCenter {
  constructor(
    private readonly snapshots = new DossierSnapshotCenter(),
    private readonly dossier = new ExpertDossierCenter()
  ) {}

  async listSnapshots(workspace: CompanyWorkspace): Promise<DossierSnapshotWithFreshness[]> {
    const rows = await prisma.dossierSnapshot.findMany({
      where: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id },
      orderBy: { createdAt: "desc" },
    });
    return Promise.all(rows.map(async (row) => ({
      ...summarizeSnapshot(row),
      freshness: await this.snapshots.getSnapshotFreshness(workspace, row.id),
    })));
  }

  async getSnapshotDetail(workspace: CompanyWorkspace, snapshotId: string): Promise<DossierSnapshotWithFreshness> {
    const row = await prisma.dossierSnapshot.findFirst({
      where: { id: snapshotId, companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id },
    });
    if (!row) throw new ExpectedRouteError("Snapshot dossier introuvable.", 404);
    return {
      ...summarizeSnapshot(row),
      freshness: await this.snapshots.getSnapshotFreshness(workspace, row.id),
    };
  }

  async getSnapshotDiff(workspace: CompanyWorkspace, snapshotId: string) {
    const snapshot = await this.getSnapshotDetail(workspace, snapshotId);
    const current = await this.dossier.getDossierOverview(workspace);
    const manifest = snapshot.manifest as { readiness?: { score?: number; status?: string }; sections?: ExpertDossierSection[] } | null;
    const previousSections = new Map((manifest?.sections ?? []).map((section) => [section.code, section]));
    const sectionDiffs = current.sections.map((section) => {
      const previous = previousSections.get(section.code);
      return {
        code: section.code,
        title: section.title,
        previousStatus: previous?.status ?? null,
        currentStatus: section.status,
        previousRisk: previous?.risk ?? null,
        currentRisk: section.risk,
        changed: !previous || previous.status !== section.status || previous.risk !== section.risk || previous.summary !== section.summary,
      };
    });
    return {
      snapshot,
      freshness: snapshot.freshness,
      readiness: {
        previousStatus: manifest?.readiness?.status ?? null,
        currentStatus: current.readiness.status,
        previousScore: manifest?.readiness?.score ?? null,
        currentScore: current.readiness.score,
      },
      sections: sectionDiffs,
      changedSections: sectionDiffs.filter((section) => section.changed),
    };
  }

  async markSnapshotSubmitted(workspace: CompanyWorkspace, snapshotId: string) {
    const row = await prisma.dossierSnapshot.findFirst({
      where: { id: snapshotId, companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id },
    });
    if (!row) throw new ExpectedRouteError("Snapshot dossier introuvable.", 404);
    const updated = await prisma.dossierSnapshot.update({ where: { id: row.id }, data: { status: "SUBMITTED" } });
    return summarizeSnapshot(updated);
  }

  async summarizeSnapshotState(workspace: CompanyWorkspace) {
    const snapshots = await this.listSnapshots(workspace);
    const latest = snapshots[0] ?? null;
    return {
      total: snapshots.length,
      latest,
      stale: snapshots.filter((snapshot) => snapshot.freshness.isStale).length,
      fresh: snapshots.filter((snapshot) => !snapshot.freshness.isStale).length,
      label: latest ? latest.freshness.statusLabel : "Aucun snapshot",
      snapshots,
    };
  }
}

function summarizeSnapshot(row: {
  id: string;
  snapshotKey: string;
  status: DossierSnapshotStatus;
  reviewRunId: string | null;
  createdAt: Date;
  manifestJson: unknown;
}): DossierSnapshotSummary {
  return {
    id: row.id,
    snapshotKey: row.snapshotKey,
    status: row.status,
    reviewRunId: row.reviewRunId,
    createdAt: row.createdAt.toISOString(),
    manifest: row.manifestJson,
  };
}

import { ActivityLogCenter } from "../activity-log/activity-log-center.server";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { ExpectedRouteError } from "../route-errors.server";
import { DossierSnapshotReviewCenter } from "./dossier-snapshot-review-center.server";
import { ExpertDossierCenter, type ExpertDossierOverview, type ExpertDossierSection } from "./expert-dossier-center.server";
import { ExpertDossierExportCenter } from "./expert-dossier-export-center.server";
import { ExpertReviewQueue } from "./expert-review-queue.server";

export type ExpertDossierReadinessItem = {
  code: string;
  severity: "blocking" | "warning";
  title: string;
  detail: string;
  href: string;
  source: "section" | "snapshot" | "review";
};

export class ExpertDossierReadinessWorkflow {
  constructor(
    private readonly dossier = new ExpertDossierCenter(),
    private readonly snapshots = new DossierSnapshotReviewCenter(),
    private readonly reviewQueue = new ExpertReviewQueue(),
    private readonly exports = new ExpertDossierExportCenter(),
    private readonly activity = new ActivityLogCenter()
  ) {}

  async getReadinessQueue(workspace: CompanyWorkspace) {
    const [overview, snapshotState, reviewReadiness] = await Promise.all([
      this.dossier.getDossierOverview(workspace),
      this.snapshots.summarizeSnapshotState(workspace),
      this.reviewQueue.summarizeReviewReadiness(workspace),
    ]);
    const items = [
      ...overview.sections.flatMap(sectionToReadinessItems),
      ...(snapshotState.latest?.freshness.isStale ? [{
        code: "snapshot_stale",
        severity: "warning" as const,
        title: "Snapshot transmis obsolète",
        detail: snapshotState.latest.freshness.reasons.map((reason) => reason.label).join(" · "),
        href: "/dossier-ec/snapshots",
        source: "snapshot" as const,
      }] : []),
      ...(reviewReadiness.openBlockingItems > 0 ? [{
        code: "expert_review_blocking_items",
        severity: "blocking" as const,
        title: "Demandes EC bloquantes ouvertes",
        detail: `${reviewReadiness.openBlockingItems} demande(s) bloquante(s) à résoudre avant signoff.`,
        href: "/dossier-ec/revue",
        source: "review" as const,
      }] : []),
      ...(reviewReadiness.signedOff ? [] : [{
        code: "expert_signoff_missing",
        severity: "warning" as const,
        title: "Validation finale EC absente",
        detail: "Le dossier peut être préparé, mais l'export final doit inclure un signoff cabinet.",
        href: "/dossier-ec/revue",
        source: "review" as const,
      }]),
    ];
    return {
      overview,
      snapshotState,
      reviewReadiness,
      items,
      blockingItems: items.filter((item) => item.severity === "blocking"),
      warnings: items.filter((item) => item.severity === "warning"),
      recommendedActions: items.map(toRecommendedAction),
    };
  }

  async getBlockingItems(workspace: CompanyWorkspace) {
    return (await this.getReadinessQueue(workspace)).blockingItems;
  }

  async getRecommendedActions(workspace: CompanyWorkspace) {
    return (await this.getReadinessQueue(workspace)).recommendedActions;
  }

  async prepareForReview(workspace: CompanyWorkspace) {
    const queue = await this.getReadinessQueue(workspace);
    const snapshot = await this.exports.prepareSnapshot(workspace);
    await this.activity.recordActivity(workspace, {
      action: "expert_dossier.prepared_for_review",
      entityType: "dossier_snapshot",
      entityId: snapshot.id,
      metadata: { warnings: queue.warnings.length },
    });
    return { snapshot, queue };
  }

  async prepareForFinalExport(workspace: CompanyWorkspace) {
    const queue = await this.getReadinessQueue(workspace);
    const latest = queue.snapshotState.latest;
    if (!latest) throw new ExpectedRouteError("Aucun snapshot transmis au cabinet.", 409);
    if (latest.freshness.isStale) throw new ExpectedRouteError("Le snapshot transmis est obsolète : prépare un nouveau dossier.", 409);
    if (queue.reviewReadiness.openBlockingItems > 0) throw new ExpectedRouteError("Des demandes EC bloquantes restent ouvertes.", 409);
    if (!queue.reviewReadiness.signedOff) throw new ExpectedRouteError("La validation finale EC est absente.", 409);
    await this.dossier.assertReadyForFinalExport(workspace);
    return { snapshot: latest, queue };
  }
}

function sectionToReadinessItems(section: ExpertDossierSection): ExpertDossierReadinessItem[] {
  if (section.status !== "blocked" && section.status !== "stale" && section.status !== "partial") return [];
  const severity = section.code === "expert_review"
    ? "warning"
    : section.status === "blocked" || section.status === "stale" || section.risk === "high"
      ? "blocking"
      : "warning";
  return [{
    code: `section_${section.code}_${section.status}`,
    severity,
    title: section.status === "stale" ? `${section.title} obsolète` : section.status === "blocked" ? `${section.title} bloqué` : `${section.title} partiel`,
    detail: section.gaps.join(" · ") || section.summary,
    href: section.href,
    source: "section",
  }];
}

function toRecommendedAction(item: ExpertDossierReadinessItem) {
  return {
    code: item.code,
    label: item.severity === "blocking" ? `Traiter : ${item.title}` : `Vérifier : ${item.title}`,
    href: item.href,
    severity: item.severity,
  };
}

export function summarizeDossierReadiness(overview: ExpertDossierOverview) {
  return {
    status: overview.readiness.status,
    label: overview.readiness.label,
    score: overview.readiness.score,
    blocked: overview.readiness.blocked,
    highRisk: overview.readiness.highRisk,
  };
}

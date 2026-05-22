import { ActivityLogCenter } from "../activity-log/activity-log-center.server";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { DocumentEvidenceBundle } from "../documents/document-evidence-bundle.server";
import { ExpectedRouteError } from "../route-errors.server";
import { DossierSnapshotCenter } from "./dossier-snapshot-center.server";
import { ExpertDossierCenter } from "./expert-dossier-center.server";
import { ExpertDossierExportVerifier } from "./expert-dossier-export-verifier.server";
import { FecPrecheckCenter } from "./fec-precheck-center.server";
import { TaxPackageCompletionCenter } from "./tax-package-completion-center.server";

export class ExpertDossierExportCenter {
  constructor(
    private readonly dossier = new ExpertDossierCenter(),
    private readonly fec = new FecPrecheckCenter(),
    private readonly taxPackage = new TaxPackageCompletionCenter(),
    private readonly evidenceBundle = new DocumentEvidenceBundle(),
    private readonly snapshots = new DossierSnapshotCenter(),
    private readonly verifier = new ExpertDossierExportVerifier(),
    private readonly activity = new ActivityLogCenter()
  ) {}

  async buildExpertDossierManifest(workspace: CompanyWorkspace) {
    const [overview, fec, taxPackage, evidenceBundle, reviewRuns, activity] = await Promise.all([
      this.dossier.getDossierOverview(workspace),
      this.fec.getFecPrecheck(workspace),
      this.taxPackage.getTaxPackageCompletion(workspace),
      this.evidenceBundle.getBundleManifest(workspace).catch((error) => ({ error: error instanceof Error ? error.message : "Paquet de preuve indisponible" })),
      prisma.expertReviewRun.findMany({
        where: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id },
        include: { items: { include: { comments: true } }, shareLink: true },
        orderBy: { createdAt: "desc" },
      }),
      new ActivityLogCenter().listActivity(workspace, { limit: 1000 }),
    ]);
    const manifest = {
      generatedAt: new Date().toISOString(),
      company: overview.company,
      fiscalYear: overview.fiscalYear,
      readiness: overview.readiness,
      sections: overview.sections,
      fec,
      taxPackage,
      evidenceBundle,
      expertReview: reviewRuns.map((run) => ({
        id: run.id,
        status: run.status,
        reviewerName: run.reviewerName,
        reviewerEmail: run.reviewerEmail,
        submittedAt: run.submittedAt?.toISOString() ?? null,
        signedOffAt: run.signedOffAt?.toISOString() ?? null,
        shareLinkId: run.shareLinkId,
        items: run.items.map((item) => ({
          id: item.id,
          sectionCode: item.sectionCode,
          severity: item.severity,
          status: item.status,
          title: item.title,
          body: item.body,
          comments: item.comments.map((comment) => ({
            authorType: comment.authorType,
            authorName: comment.authorName,
            body: comment.body,
            createdAt: comment.createdAt.toISOString(),
          })),
        })),
      })),
      activity,
    };
    return {
      ...manifest,
      exportVerification: await this.verifier.verifyManifest(workspace, manifest),
    };
  }

  async downloadExpertDossier(workspace: CompanyWorkspace) {
    const manifest = await this.buildExpertDossierManifest(workspace);
    await this.activity.recordActivity(workspace, {
      action: "expert_dossier.exported",
      entityType: "expert_dossier",
      entityId: workspace.fiscalYear.id,
      metadata: { status: manifest.readiness.status, score: manifest.readiness.score },
    });
    return {
      body: JSON.stringify(manifest, null, 2),
      filename: `dossier-ec-${workspace.company.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${workspace.fiscalYear.endDate.getFullYear()}.json`,
      contentType: "application/json",
    };
  }

  async assertExportable(workspace: CompanyWorkspace) {
    const overview = await this.dossier.assertReadyForFinalExport(workspace);
    await this.fec.assertFecExportable(workspace);
    await this.taxPackage.assertStructuredTaxPackageReady(workspace);
    return overview;
  }

  async prepareSnapshot(workspace: CompanyWorkspace, input: { reviewRunId?: string | null; final?: boolean } = {}) {
    const manifest = await this.buildExpertDossierManifest(workspace);
    if (input.final && manifest.readiness.status !== "ready_for_final_export") {
      throw new ExpectedRouteError("Le dossier n'est pas prêt pour un snapshot final.", 409);
    }
    const snapshot = await this.snapshots.createSnapshot(workspace, {
      reviewRunId: input.reviewRunId,
      status: input.final ? "FINAL" : "SUBMITTED",
      manifest,
    });
    await this.activity.recordActivity(workspace, {
      action: "expert_dossier.snapshot_created",
      entityType: "dossier_snapshot",
      entityId: snapshot.id,
      metadata: { status: snapshot.status },
    });
    return snapshot;
  }
}

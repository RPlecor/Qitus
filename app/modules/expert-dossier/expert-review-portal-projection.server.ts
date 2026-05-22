import { ActivityLogCenter } from "../activity-log/activity-log-center.server";
import { ExpectedRouteError } from "../route-errors.server";
import { ExpertReviewShareCenter } from "../expert-review/expert-review-share-center.server";
import { DossierSnapshotReviewCenter } from "./dossier-snapshot-review-center.server";
import { ExpertDossierCenter } from "./expert-dossier-center.server";
import { ExpertReviewQueue } from "./expert-review-queue.server";
import { ExpertReviewWorkflow } from "./expert-review-workflow.server";

const allowedSharedActions = new Set([
  "view",
  "create_review_item",
  "add_comment",
  "request_changes",
  "signoff",
]);

export class ExpertReviewPortalProjection {
  constructor(
    private readonly shareCenter = new ExpertReviewShareCenter(),
    private readonly dossier = new ExpertDossierCenter(),
    private readonly snapshots = new DossierSnapshotReviewCenter(),
    private readonly reviewQueue = new ExpertReviewQueue(),
    private readonly workflow = new ExpertReviewWorkflow(),
    private readonly activity = new ActivityLogCenter()
  ) {}

  async getSharedPortal(token: string) {
    this.assertReadOnlyPermission(token, "view");
    const shared = await this.shareCenter.getSharedReview(token);
    const [dossier, review, reviewQueue, snapshotState] = await Promise.all([
      this.dossier.getDossierOverview(shared.workspace),
      this.workflow.getReview(shared.workspace),
      this.reviewQueue.getReviewQueue(shared.workspace, { status: "all" }),
      this.snapshots.summarizeSnapshotState(shared.workspace),
    ]);
    return {
      ...shared,
      dossier,
      activeReview: review,
      items: reviewQueue.items,
      reviewSummary: reviewQueue.summary,
      snapshotState,
      transmittedSnapshot: snapshotState.latest,
      isTransmittedDossierStale: snapshotState.latest?.freshness.isStale ?? false,
    };
  }

  async getSharedSection(token: string, sectionCode: string) {
    const portal = await this.getSharedPortal(token);
    const section = portal.dossier.sections.find((candidate) => candidate.code === sectionCode);
    if (!section) throw new ExpectedRouteError("Section partagée introuvable.", 404);
    return { section, snapshot: portal.transmittedSnapshot };
  }

  assertReadOnlyPermission(_token: string, action: string) {
    if (!allowedSharedActions.has(action)) {
      throw new ExpectedRouteError("Le lien cabinet est en lecture seule : cette action comptable n'est pas autorisée.", 403);
    }
  }

  async getSharedAuditTrail(token: string) {
    const portal = await this.getSharedPortal(token);
    return this.activity.listActivity(portal.workspace, { limit: 100 });
  }
}

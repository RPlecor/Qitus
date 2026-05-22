import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { ExpectedRouteError } from "../route-errors.server";
import { EvidenceRequirementCenter } from "../accounting-coverage/evidence-requirement-center.server";
import { AttachmentLinkCenter } from "./attachment-link-center.server";

export type EvidenceReview = {
  status: "ready" | "missing_required" | "needs_attention";
  requiredMissing: number;
  recommendedMissing: number;
  orphanAttachments: number;
  extractionFailures: number;
};

export class EvidenceControlCenter {
  constructor(
    private readonly requirements = new EvidenceRequirementCenter(),
    private readonly links = new AttachmentLinkCenter()
  ) {}

  async getEvidenceReview(workspace: CompanyWorkspace): Promise<EvidenceReview> {
    const [summary, orphans, extractionFailures] = await Promise.all([
      this.requirements.summarizeEvidenceGaps(workspace),
      this.links.listOrphanAttachments(workspace),
      prisma.attachment.count({ where: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id, status: "EXTRACTION_FAILED", archivedAt: null } }),
    ]);
    return {
      status: summary.requiredMissing > 0 ? "missing_required" : orphans.length > 0 || extractionFailures > 0 || summary.recommendedMissing > 0 ? "needs_attention" : "ready",
      requiredMissing: summary.requiredMissing,
      recommendedMissing: summary.recommendedMissing,
      orphanAttachments: orphans.length,
      extractionFailures,
    };
  }

  async listEntriesWithoutEvidence(workspace: CompanyWorkspace) {
    return (await this.requirements.listMissingEvidence(workspace, { level: "required" })).filter((requirement) =>
      requirement.entityType === "journal_entry" || requirement.entityType === "transaction" || requirement.entityType === "closing_adjustment"
    );
  }

  async listAttachmentsWithoutAccountingLink(workspace: CompanyWorkspace) {
    return this.links.listOrphanAttachments(workspace);
  }

  async assertEvidenceCoverage(workspace: CompanyWorkspace) {
    const review = await this.getEvidenceReview(workspace);
    if (review.requiredMissing > 0) {
      throw new ExpectedRouteError(`${review.requiredMissing} pièce(s) requise(s) manquent encore au dossier.`, 409);
    }
    return review;
  }
}

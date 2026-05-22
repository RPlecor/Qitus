import type { AttachmentRelationType } from "@prisma/client";
import type { EvidenceRequirement, EvidenceRequirementLevel } from "../accounting-coverage/evidence-requirement-center.server";
import { EvidenceRequirementCenter, summarizeEvidenceRequirements } from "../accounting-coverage/evidence-requirement-center.server";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { ExpectedRouteError } from "../route-errors.server";
import { AttachmentCenter, type AttachmentUploadInput } from "./attachment-center.server";
import { AttachmentLinkCenter } from "./attachment-link-center.server";
import { attachmentEntityTypeForRequirement, relationTypeForEvidenceKind } from "./attachment-matching-center.server";

export type EvidenceReviewFilters = {
  level?: EvidenceRequirementLevel | "all" | null;
};

export type EvidenceReviewQueue = {
  active: EvidenceRequirement[];
  required: EvidenceRequirement[];
  recommended: EvidenceRequirement[];
  satisfied: EvidenceRequirement[];
  summary: ReturnType<typeof summarizeEvidenceRequirements> & {
    active: number;
  };
};

export type UploadAndResolveRequirementInput = AttachmentUploadInput & {
  requirementId: string;
  note?: string | null;
};

export type LinkAttachmentToRequirementInput = {
  requirementId: string;
  attachmentId: string;
  note?: string | null;
};

export class EvidenceReviewWorkflow {
  constructor(
    private readonly requirements = new EvidenceRequirementCenter(),
    private readonly attachments = new AttachmentCenter(),
    private readonly links = new AttachmentLinkCenter()
  ) {}

  async getReviewQueue(workspace: CompanyWorkspace, filters: EvidenceReviewFilters = {}): Promise<EvidenceReviewQueue> {
    const requirements = await this.requirements.listEvidenceRequirements(workspace);
    return buildEvidenceReviewQueue(requirements, filters);
  }

  async getRequirement(workspace: CompanyWorkspace, requirementId: string) {
    return this.requirements.getRequirementDetail(workspace, requirementId);
  }

  async uploadAndResolveRequirement(workspace: CompanyWorkspace, input: UploadAndResolveRequirementInput) {
    const requirement = await this.getRequirement(workspace, input.requirementId);
    if (!requirement.missing) throw new ExpectedRouteError("Cette exigence est déjà satisfaite.", 409);
    const attachment = await this.attachments.uploadAttachment(workspace, {
      filename: input.filename,
      mimeType: input.mimeType,
      bytes: input.bytes,
    });
    const link = await this.links.linkAttachment(workspace, {
      attachmentId: attachment.id,
      ...linkTargetForRequirement(requirement),
      note: input.note || `Rattachement depuis l'exigence ${requirement.id}`,
    });
    return { attachment, link, requirement };
  }

  async linkAttachmentToRequirement(workspace: CompanyWorkspace, input: LinkAttachmentToRequirementInput) {
    const requirement = await this.getRequirement(workspace, input.requirementId);
    if (!requirement.missing) throw new ExpectedRouteError("Cette exigence est déjà satisfaite.", 409);
    const link = await this.links.linkAttachment(workspace, {
      attachmentId: input.attachmentId,
      ...linkTargetForRequirement(requirement),
      note: input.note || `Rattachement depuis l'exigence ${requirement.id}`,
    });
    return { link, requirement };
  }

  async summarizeEvidenceReadiness(workspace: CompanyWorkspace) {
    const queue = await this.getReviewQueue(workspace);
    return {
      status: queue.summary.requiredMissing > 0 ? "missing_required" : queue.summary.recommendedMissing > 0 ? "ready_with_recommendations" : "ready",
      ...queue.summary,
    };
  }
}

export function buildEvidenceReviewQueue(requirements: EvidenceRequirement[], filters: EvidenceReviewFilters = {}): EvidenceReviewQueue {
  const filtered = requirements.filter((requirement) => !filters.level || filters.level === "all" || requirement.level === filters.level);
  const active = filtered.filter((requirement) => requirement.missing);
  const required = active.filter((requirement) => requirement.level === "required");
  const recommended = active.filter((requirement) => requirement.level === "recommended");
  const satisfied = filtered.filter((requirement) => !requirement.missing);
  return {
    active: sortRequirements(active),
    required: sortRequirements(required),
    recommended: sortRequirements(recommended),
    satisfied: sortRequirements(satisfied),
    summary: {
      ...summarizeEvidenceRequirements(filtered),
      active: active.length,
    },
  };
}

export function linkTargetForRequirement(requirement: EvidenceRequirement): {
  entityType: ReturnType<typeof attachmentEntityTypeForRequirement>;
  entityId: string;
  relationType: AttachmentRelationType;
} {
  return {
    entityType: attachmentEntityTypeForRequirement(requirement),
    entityId: requirement.entityId,
    relationType: relationTypeForEvidenceKind(requirement.kind),
  };
}

function sortRequirements(requirements: EvidenceRequirement[]) {
  return [...requirements].sort((a, b) => {
    const level = levelWeight(a.level) - levelWeight(b.level);
    if (level !== 0) return level;
    return a.label.localeCompare(b.label, "fr");
  });
}

function levelWeight(level: EvidenceRequirementLevel) {
  if (level === "required") return 0;
  if (level === "recommended") return 1;
  return 2;
}

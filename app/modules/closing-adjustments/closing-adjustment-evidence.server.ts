import type { AttachmentLink, ClosingAdjustmentProposal } from "@prisma/client";
import type { ClosingAdjustmentSummary } from "./closing-adjustment-center.server";

export type ClosingAdjustmentEvidenceLink = Pick<AttachmentLink, "id" | "entityType" | "entityId" | "relationType" | "createdAt"> & {
  attachment?: {
    id: string;
    originalFilename: string;
    status: string;
  };
};

export type ClosingAdjustmentEvidenceSummary = {
  required: boolean;
  missing: boolean;
  expectedRelationType: "USER_DECISION" | "OTHER";
  links: Array<{
    id: string;
    entityType: string;
    entityId: string;
    relationType: string;
    filename: string | null;
    createdAt: string;
  }>;
};

export function closingAdjustmentRequiresEvidence(
  proposal: Pick<ClosingAdjustmentSummary, "kind" | "calculation">
): boolean {
  if (proposal.kind === "VAT_SETTLEMENT" || proposal.kind === "CORPORATE_TAX") {
    return proposal.calculation.requiredEvidence === true;
  }
  return proposal.calculation.requiredEvidence !== false;
}

export function summarizeClosingAdjustmentEvidence(
  proposal: Pick<ClosingAdjustmentSummary, "id" | "proposalKey" | "journalEntryId" | "kind" | "calculation">,
  links: ClosingAdjustmentEvidenceLink[]
): ClosingAdjustmentEvidenceSummary {
  const required = closingAdjustmentRequiresEvidence(proposal);
  const compatible = links.filter((link) => isCompatibleClosingAdjustmentEvidence(proposal, link));
  return {
    required,
    missing: required && compatible.length === 0,
    expectedRelationType: "USER_DECISION",
    links: compatible.map((link) => ({
      id: link.id,
      entityType: link.entityType,
      entityId: link.entityId,
      relationType: link.relationType,
      filename: link.attachment?.originalFilename ?? null,
      createdAt: link.createdAt.toISOString(),
    })),
  };
}

export function isCompatibleClosingAdjustmentEvidence(
  proposal: Pick<ClosingAdjustmentSummary, "id" | "proposalKey" | "journalEntryId"> | Pick<ClosingAdjustmentProposal, "id" | "proposalKey" | "journalEntryId">,
  link: Pick<AttachmentLink, "entityType" | "entityId" | "relationType">
) {
  const relationOk = link.relationType === "USER_DECISION" || link.relationType === "OTHER";
  if (!relationOk) return false;
  if (link.entityType === "CLOSING_ADJUSTMENT" && (link.entityId === proposal.proposalKey || link.entityId === proposal.id)) return true;
  if (proposal.journalEntryId && link.entityType === "JOURNAL_ENTRY" && link.entityId === proposal.journalEntryId) return true;
  return false;
}

export function workpaperKeyFromClosingProposalKey(proposalKey: string) {
  const prefix = "CLOSING_WORKPAPER:";
  if (!proposalKey.startsWith(prefix)) return null;
  const [, , ...parts] = proposalKey.split(":");
  return parts.length > 0 ? parts.join(":") : null;
}

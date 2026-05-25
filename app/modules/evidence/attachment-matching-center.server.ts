import type { AttachmentEntityType, AttachmentRelationType } from "@prisma/client";
import type { EvidenceRequirement, EvidenceRequirementKind, EvidenceRequirementLevel } from "../accounting-coverage/evidence-requirement-center.server";
import { EvidenceRequirementCenter } from "../accounting-coverage/evidence-requirement-center.server";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { ReconciliationPolicyCenter } from "../official-references/reconciliation-policy-center.server";
import { ExpectedRouteError } from "../route-errors.server";

export type AttachmentMatchSuggestion = {
  requirementId: string;
  entityType: AttachmentEntityType;
  entityId: string;
  relationType: AttachmentRelationType;
  label: string;
  score: number;
  reasons: string[];
  href: string;
  requirementLevel: EvidenceRequirementLevel;
};

export type AttachmentMatchPreviewInput = {
  attachmentId: string;
  requirementId: string;
};

type AttachmentMatchSource = {
  id: string;
  supplierName: string | null;
  invoiceDate: Date | null;
  amountTtc: { toNumber(): number } | null;
};

type RequirementFact = {
  requirementId: string;
  text: string;
  amount: number | null;
  date: Date | null;
};

export class AttachmentMatchingCenter {
  constructor(
    private readonly requirements = new EvidenceRequirementCenter(),
    private readonly reconciliationPolicy = new ReconciliationPolicyCenter()
  ) {}

  async suggestLinksForAttachment(workspace: CompanyWorkspace, attachmentId: string): Promise<AttachmentMatchSuggestion[]> {
    const attachment = await this.getAttachment(workspace, attachmentId);
    const requirements = await this.requirements.listEvidenceRequirements(workspace);
    return this.rankMatches(workspace, attachment, requirements.filter((requirement) => requirement.missing));
  }

  async suggestAttachmentsForRequirement(workspace: CompanyWorkspace, requirementId: string): Promise<Array<AttachmentMatchSuggestion & { attachmentId: string; filename: string }>> {
    const requirement = await this.requirements.getRequirementDetail(workspace, requirementId);
    const attachments = await prisma.attachment.findMany({
      where: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id, archivedAt: null },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const ranked: Array<(AttachmentMatchSuggestion & { attachmentId: string; filename: string }) | null> = await Promise.all(attachments.map(async (attachment) => {
      const [suggestion] = await this.rankMatches(workspace, attachment, [requirement]);
      return suggestion ? { ...suggestion, attachmentId: attachment.id, filename: attachment.originalFilename } : null;
    }));
    return ranked.filter((suggestion): suggestion is AttachmentMatchSuggestion & { attachmentId: string; filename: string } => suggestion !== null)
      .sort((a, b) => b.score - a.score);
  }

  async previewAttachmentLink(workspace: CompanyWorkspace, input: AttachmentMatchPreviewInput) {
    const attachment = await this.getAttachment(workspace, input.attachmentId);
    const requirement = await this.requirements.getRequirementDetail(workspace, input.requirementId);
    const [suggestion] = await this.rankMatches(workspace, attachment, [requirement]);
    if (!suggestion) throw new ExpectedRouteError("Rattachement incompatible avec cette exigence.", 400);
    return suggestion;
  }

  private async getAttachment(workspace: CompanyWorkspace, attachmentId: string) {
    const attachment = await prisma.attachment.findFirst({
      where: { id: attachmentId, companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id, archivedAt: null },
    });
    if (!attachment) throw new ExpectedRouteError("Pièce introuvable.", 404);
    return attachment;
  }

  private async rankMatches(workspace: CompanyWorkspace, attachment: AttachmentMatchSource, requirements: EvidenceRequirement[]) {
    const facts = await loadRequirementFacts(workspace, requirements);
    const exactAmountEpsilon = (await this.reconciliationPolicy.getTolerances()).exactAmountEpsilon;
    return requirements.map((requirement) => {
      const fact = facts.get(requirement.id);
      const relationType = relationTypeForEvidenceKind(requirement.kind);
      const entityType = attachmentEntityTypeForRequirement(requirement);
      const scoring = scoreAttachmentMatch(attachment, requirement, fact, exactAmountEpsilon);
      return {
        requirementId: requirement.id,
        entityType,
        entityId: requirement.entityId,
        relationType,
        label: requirement.label,
        score: scoring.score,
        reasons: scoring.reasons,
        href: requirement.href,
        requirementLevel: requirement.level,
      };
    })
      .filter((suggestion) => suggestion.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }
}

export function attachmentEntityTypeForRequirement(requirement: EvidenceRequirement): AttachmentEntityType {
  const map: Record<EvidenceRequirement["entityType"], AttachmentEntityType> = {
    transaction: "TRANSACTION",
    journal_entry: "JOURNAL_ENTRY",
    closing_adjustment: "CLOSING_ADJUSTMENT",
    fiscal_year: "FISCAL_YEAR",
  };
  return map[requirement.entityType];
}

export function relationTypeForEvidenceKind(kind: EvidenceRequirementKind): AttachmentRelationType {
  const map: Record<EvidenceRequirementKind, AttachmentRelationType> = {
    invoice: "INVOICE",
    receipt: "RECEIPT",
    bank_statement: "BANK_STATEMENT",
    contract: "CONTRACT",
    user_decision: "USER_DECISION",
    expert_validation: "EXPERT_VALIDATION",
  };
  return map[kind];
}

export function scoreAttachmentMatch(
  attachment: { supplierName: string | null; invoiceDate: Date | null; amountTtc: { toNumber(): number } | null },
  requirement: Pick<EvidenceRequirement, "kind" | "label">,
  fact: RequirementFact | undefined,
  exactAmountEpsilon: number
) {
  const reasons: string[] = [];
  let score = relationCompatibilityScore(requirement.kind);
  if (score > 0) reasons.push("type de preuve compatible");

  const attachmentAmount = attachment.amountTtc?.toNumber();
  if (attachmentAmount != null && fact?.amount != null) {
    const delta = Math.abs(Math.abs(attachmentAmount) - Math.abs(fact.amount));
    if (delta <= exactAmountEpsilon) {
      score += 45;
      reasons.push("montant exact");
    } else if (delta <= 1) {
      score += 30;
      reasons.push("montant proche");
    }
  }

  if (attachment.invoiceDate && fact?.date) {
    const days = Math.abs(attachment.invoiceDate.getTime() - fact.date.getTime()) / 86_400_000;
    if (days <= 14) {
      score += 20;
      reasons.push("date proche");
    } else if (days <= 30) {
      score += 10;
      reasons.push("date plausible");
    }
  }

  const supplier = attachment.supplierName?.trim().toLowerCase();
  if (supplier && fact?.text.toLowerCase().includes(supplier)) {
    score += 25;
    reasons.push("fournisseur reconnu");
  }

  if (score === relationCompatibilityScore(requirement.kind) && requirement.kind === "expert_validation") {
    reasons.push("preuve d'exercice");
  }

  return { score, reasons };
}

async function loadRequirementFacts(workspace: CompanyWorkspace, requirements: EvidenceRequirement[]): Promise<Map<string, RequirementFact>> {
  const byRequirement = new Map<string, RequirementFact>();
  const transactionIds = requirements.filter((item) => item.entityType === "transaction").map((item) => item.entityId);
  const entryIds = requirements.filter((item) => item.entityType === "journal_entry").map((item) => item.entityId);
  const proposalKeys = requirements.filter((item) => item.entityType === "closing_adjustment").map((item) => item.entityId);

  const [transactions, entries, proposals] = await Promise.all([
    transactionIds.length > 0 ? prisma.transaction.findMany({ where: { fiscalYearId: workspace.fiscalYear.id, id: { in: transactionIds } } }) : [],
    entryIds.length > 0 ? prisma.journalEntry.findMany({ where: { fiscalYearId: workspace.fiscalYear.id, id: { in: entryIds } }, include: { lines: true } }) : [],
    proposalKeys.length > 0 ? prisma.closingAdjustmentProposal.findMany({ where: { fiscalYearId: workspace.fiscalYear.id, proposalKey: { in: proposalKeys } } }) : [],
  ]);

  const transactionById = new Map(transactions.map((transaction) => [transaction.id, transaction]));
  const entryById = new Map(entries.map((entry) => [entry.id, entry]));
  const proposalByKey = new Map(proposals.map((proposal) => [proposal.proposalKey, proposal]));

  for (const requirement of requirements) {
    if (requirement.entityType === "transaction") {
      const transaction = transactionById.get(requirement.entityId);
      if (transaction) {
        byRequirement.set(requirement.id, {
          requirementId: requirement.id,
          text: `${transaction.label} ${transaction.counterparty ?? ""}`,
          amount: transaction.amount.toNumber(),
          date: transaction.date,
        });
      }
    } else if (requirement.entityType === "journal_entry") {
      const entry = entryById.get(requirement.entityId);
      if (entry) {
        byRequirement.set(requirement.id, {
          requirementId: requirement.id,
          text: entry.label,
          amount: Math.max(...entry.lines.map((line) => line.debit.toNumber()), ...entry.lines.map((line) => line.credit.toNumber()), 0),
          date: entry.date,
        });
      }
    } else if (requirement.entityType === "closing_adjustment") {
      const proposal = proposalByKey.get(requirement.entityId);
      byRequirement.set(requirement.id, {
        requirementId: requirement.id,
        text: `${requirement.label} ${proposal?.label ?? ""}`,
        amount: null,
        date: proposal?.updatedAt ?? null,
      });
    } else {
      byRequirement.set(requirement.id, {
        requirementId: requirement.id,
        text: requirement.label,
        amount: null,
        date: workspace.fiscalYear.endDate,
      });
    }
  }

  return byRequirement;
}

function relationCompatibilityScore(kind: EvidenceRequirementKind) {
  return kind === "expert_validation" ? 8 : 10;
}

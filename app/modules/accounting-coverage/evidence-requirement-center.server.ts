import type { EntrySource } from "@prisma/client";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { EvidenceRequirementPolicyCenter } from "../official-references/evidence-requirement-policy-center.server";
import { ExpectedRouteError } from "../route-errors.server";

export type EvidenceRequirementKind = "invoice" | "receipt" | "bank_statement" | "contract" | "user_decision" | "expert_validation";
export type EvidenceRequirementLevel = "required" | "recommended" | "not_applicable";

export type EvidenceRequirement = {
  id: string;
  entityType: "journal_entry" | "transaction" | "closing_adjustment" | "fiscal_year";
  entityId: string;
  label: string;
  kind: EvidenceRequirementKind;
  level: EvidenceRequirementLevel;
  missing: boolean;
  href: string;
};

export type EvidenceRequirementSummary = {
  total: number;
  missing: number;
  requiredMissing: number;
  recommendedMissing: number;
  satisfied: number;
  requiredTotal: number;
  recommendedTotal: number;
  byKind: Record<EvidenceRequirementKind, number>;
};

type EvidenceEntry = {
  id: string;
  num: number;
  journal: string;
  label: string;
  source: EntrySource;
  transactions: Array<{ id: string; amount: { toNumber(): number } }>;
  closingAdjustmentProposal: { id: string; proposalKey: string } | null;
};

type EvidenceLink = {
  entityType: string;
  entityId: string;
  relationType: string;
};

type EvidenceClosingProposal = {
  id: string;
  proposalKey: string;
  kind: string;
  label: string;
  status: string;
  calculationJson: unknown;
  journalEntryId: string | null;
};

export class EvidenceRequirementCenter {
  constructor(private readonly evidencePolicy = new EvidenceRequirementPolicyCenter()) {}

  async listEvidenceRequirements(workspace: CompanyWorkspace): Promise<EvidenceRequirement[]> {
    const [entries, draftProposals, links, expertValidation] = await Promise.all([
      prisma.journalEntry.findMany({
        where: { fiscalYearId: workspace.fiscalYear.id },
        include: {
          transactions: { select: { id: true, amount: true } },
          closingAdjustmentProposal: { select: { id: true, proposalKey: true } },
        },
        orderBy: [{ date: "asc" }, { num: "asc" }],
      }),
      prisma.closingAdjustmentProposal.findMany({
        where: { fiscalYearId: workspace.fiscalYear.id, journalEntryId: null, status: { in: ["DRAFT", "REJECTED"] } },
        select: { id: true, proposalKey: true, kind: true, label: true, status: true, calculationJson: true, journalEntryId: true },
        orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      }),
      prisma.attachmentLink.findMany({
        where: { attachment: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id, archivedAt: null } },
        select: { entityType: true, entityId: true, relationType: true },
      }),
      prisma.shareLink.findFirst({
        where: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id, reviewedAt: { not: null } },
        select: { id: true },
      }),
    ]);
    return buildEvidenceRequirements(entries, {
      fiscalYearId: workspace.fiscalYear.id,
      hasExpertValidation: Boolean(expertValidation),
      links,
      draftProposals,
    });
  }

  async listMissingEvidence(workspace: CompanyWorkspace, filters: { level?: EvidenceRequirementLevel | null; kind?: EvidenceRequirementKind | null } = {}) {
    return (await this.listEvidenceRequirements(workspace)).filter((requirement) => (
      requirement.missing &&
      (!filters.level || requirement.level === filters.level) &&
      (!filters.kind || requirement.kind === filters.kind)
    ));
  }

  getEvidencePolicy() {
    const wording = this.evidencePolicy.getWording();
    return {
      importEntries: `Les écritures issues d'un import sont suivies comme ${wording.nonBlockingGap} tant qu'aucun justificatif n'est rattaché.`,
      closingAdjustments: "Les OD de clôture doivent être reliées à une décision utilisateur ou à un calcul auditable quand le référentiel l'exige.",
      expertReview: "La validation expert-comptable est recommandée avant beta externe.",
    };
  }

  async summarizeEvidenceGaps(workspace: CompanyWorkspace): Promise<EvidenceRequirementSummary> {
    return summarizeEvidenceRequirements(await this.listEvidenceRequirements(workspace));
  }

  async getRequirementDetail(workspace: CompanyWorkspace, requirementId: string) {
    const requirement = (await this.listEvidenceRequirements(workspace)).find((candidate) => candidate.id === requirementId);
    if (!requirement) throw new ExpectedRouteError("Exigence de preuve introuvable.", 404);
    return requirement;
  }
}

export function buildEvidenceRequirements(
  entries: EvidenceEntry[],
  context: { fiscalYearId: string; hasExpertValidation: boolean; links?: EvidenceLink[]; draftProposals?: EvidenceClosingProposal[] }
): EvidenceRequirement[] {
  const links = context.links ?? [];
  const requirements = entries.flatMap((entry) => requirementsForEntry(entry, links));
  requirements.push(...(context.draftProposals ?? []).map((proposal) => requirementForClosingProposal(proposal, links)));
  requirements.push({
    id: `expert-validation:${context.fiscalYearId}`,
    entityType: "fiscal_year",
    entityId: context.fiscalYearId,
    label: "Validation expert-comptable du dossier",
    kind: "expert_validation",
    level: "recommended",
    missing: !context.hasExpertValidation && !hasCompatibleLink(links, "FISCAL_YEAR", context.fiscalYearId, "expert_validation"),
    href: "/cloture",
  });
  return requirements;
}

function requirementForClosingProposal(proposal: EvidenceClosingProposal, links: EvidenceLink[]): EvidenceRequirement {
  const required = closingProposalRequiresEvidence(proposal);
  return {
    id: `closing-adjustment:${proposal.proposalKey}:user_decision`,
    entityType: "closing_adjustment",
    entityId: proposal.proposalKey,
    label: `${required ? "Décision requise" : "Décision recommandée"} pour OD ${proposal.label}`,
    kind: "user_decision",
    level: required ? "required" : "recommended",
    missing: !hasCompatibleClosingProposalLink(links, proposal),
    href: `/controle/od/${encodeURIComponent(proposal.proposalKey)}`,
  };
}

export function summarizeEvidenceRequirements(requirements: EvidenceRequirement[]): EvidenceRequirementSummary {
  const byKind = emptyKindCounts();
  for (const requirement of requirements) {
    if (requirement.missing) byKind[requirement.kind] += 1;
  }
  return {
    total: requirements.length,
    missing: requirements.filter((requirement) => requirement.missing).length,
    requiredMissing: requirements.filter((requirement) => requirement.missing && requirement.level === "required").length,
    recommendedMissing: requirements.filter((requirement) => requirement.missing && requirement.level === "recommended").length,
    satisfied: requirements.filter((requirement) => !requirement.missing).length,
    requiredTotal: requirements.filter((requirement) => requirement.level === "required").length,
    recommendedTotal: requirements.filter((requirement) => requirement.level === "recommended").length,
    byKind,
  };
}

function requirementsForEntry(entry: EvidenceEntry, links: EvidenceLink[]): EvidenceRequirement[] {
  if (entry.source === "CLOSING_ADJUSTMENT") {
    return [{
      id: `entry:${entry.id}:user_decision`,
      entityType: "closing_adjustment",
      entityId: entry.closingAdjustmentProposal?.proposalKey ?? entry.id,
      label: `Décision utilisateur pour OD ${entry.num} - ${entry.label}`,
      kind: "user_decision",
      level: "required",
      missing: !hasCompatibleLink(links, "CLOSING_ADJUSTMENT", entry.closingAdjustmentProposal?.proposalKey ?? entry.id, "user_decision") &&
        !hasCompatibleLink(links, "JOURNAL_ENTRY", entry.id, "user_decision"),
      href: entry.closingAdjustmentProposal?.proposalKey ? `/controle/od/${encodeURIComponent(entry.closingAdjustmentProposal.proposalKey)}` : "/controle",
    }];
  }
  if (entry.source === "MANUAL") {
    return [{
      id: `entry:${entry.id}:receipt`,
      entityType: "journal_entry",
      entityId: entry.id,
      label: `Justificatif pour écriture manuelle ${entry.num} - ${entry.label}`,
      kind: "receipt",
      level: "required",
      missing: !hasCompatibleLink(links, "JOURNAL_ENTRY", entry.id, "receipt"),
      href: "/ecritures",
    }];
  }
  return entry.transactions.length > 0
    ? entry.transactions.map((transaction) => {
      const kind = transaction.amount.toNumber() >= 0 ? "contract" as const : "invoice" as const;
      return {
        id: `transaction:${transaction.id}:${kind}`,
        entityType: "transaction" as const,
        entityId: transaction.id,
        label: `Pièce pour transaction ${entry.num} - ${entry.label}`,
        kind,
        level: "required" as const,
        missing: !hasCompatibleLink(links, "TRANSACTION", transaction.id, kind) && !hasCompatibleLink(links, "JOURNAL_ENTRY", entry.id, kind),
        href: `/transactions/${transaction.id}`,
      };
    })
    : [{
        id: `entry:${entry.id}:bank_statement`,
        entityType: "journal_entry",
        entityId: entry.id,
        label: `Relevé bancaire pour écriture ${entry.num} - ${entry.label}`,
        kind: "bank_statement",
        level: "recommended",
        missing: !hasCompatibleLink(links, "JOURNAL_ENTRY", entry.id, "bank_statement"),
        href: "/ecritures",
      }];
}

function emptyKindCounts(): Record<EvidenceRequirementKind, number> {
  return {
    invoice: 0,
    receipt: 0,
    bank_statement: 0,
    contract: 0,
    user_decision: 0,
    expert_validation: 0,
  };
}

function hasCompatibleLink(links: EvidenceLink[], entityType: string, entityId: string, kind: EvidenceRequirementKind) {
  const expected = relationForKind(kind);
  return links.some((link) =>
    link.entityType === entityType &&
    link.entityId === entityId &&
    (link.relationType === expected || link.relationType === "OTHER")
  );
}

function hasCompatibleClosingProposalLink(links: EvidenceLink[], proposal: Pick<EvidenceClosingProposal, "id" | "proposalKey" | "journalEntryId">) {
  return links.some((link) => {
    const relationOk = link.relationType === "USER_DECISION" || link.relationType === "OTHER";
    if (!relationOk) return false;
    if (link.entityType === "CLOSING_ADJUSTMENT" && (link.entityId === proposal.proposalKey || link.entityId === proposal.id)) return true;
    if (proposal.journalEntryId && link.entityType === "JOURNAL_ENTRY" && link.entityId === proposal.journalEntryId) return true;
    return false;
  });
}

function closingProposalRequiresEvidence(proposal: Pick<EvidenceClosingProposal, "kind" | "calculationJson">) {
  const calculation = proposal.calculationJson && typeof proposal.calculationJson === "object" && !Array.isArray(proposal.calculationJson)
    ? proposal.calculationJson as Record<string, unknown>
    : {};
  if (proposal.kind === "VAT_SETTLEMENT" || proposal.kind === "CORPORATE_TAX") return calculation.requiredEvidence === true;
  return calculation.requiredEvidence !== false;
}

function relationForKind(kind: EvidenceRequirementKind) {
  const map: Record<EvidenceRequirementKind, string> = {
    invoice: "INVOICE",
    receipt: "RECEIPT",
    bank_statement: "BANK_STATEMENT",
    contract: "CONTRACT",
    user_decision: "USER_DECISION",
    expert_validation: "EXPERT_VALIDATION",
  };
  return map[kind];
}

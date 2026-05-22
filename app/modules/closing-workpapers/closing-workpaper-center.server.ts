import { Prisma } from "@prisma/client";
import { ActivityLogCenter } from "../activity-log/activity-log-center.server";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { ExpectedRouteError } from "../route-errors.server";
import {
  CLOSING_KIND_DEFINITIONS,
  buildGeneralClosingDraft,
  definitionForKind,
  type ClosingAdjustmentDraftBuildResult,
} from "./general-closing-calculators.server";
import { ReconciliationAdjustmentCenter } from "./reconciliation-adjustment-center.server";
import { VatSettlementAdjustmentCenter } from "./vat-settlement-adjustment-center.server";

export type ClosingWorkpaperFilters = {
  kind?: string | null;
  includeArchived?: boolean;
};

export type ClosingWorkpaperSummary = {
  id: string;
  workpaperKey: string;
  kind: string;
  status: string;
  title: string;
  sourceEntityType: string | null;
  sourceEntityId: string | null;
  assumptions: Record<string, unknown>;
  calculation: Record<string, unknown>;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ClosingWorkpaperSaveInput = {
  workpaperKey?: string | null;
  kind: string;
  title?: string | null;
  status?: string | null;
  sourceEntityType?: string | null;
  sourceEntityId?: string | null;
  assumptions?: Record<string, unknown>;
  calculation?: Record<string, unknown>;
  note?: string | null;
};

export type ClosingWorkpaperSummaryState = {
  total: number;
  draft: number;
  ready: number;
  archived: number;
  proposals: {
    draft: number;
    approved: number;
    rejected: number;
  };
  requiredEvidenceMissing: number;
};

export class ClosingWorkpaperCenter {
  constructor(
    private readonly activity = new ActivityLogCenter(),
    private readonly vatSettlement = new VatSettlementAdjustmentCenter(),
    private readonly reconciliationAdjustments = new ReconciliationAdjustmentCenter()
  ) {}

  async listWorkpapers(workspace: CompanyWorkspace, filters: ClosingWorkpaperFilters = {}): Promise<ClosingWorkpaperSummary[]> {
    const rows = await prisma.closingWorkpaper.findMany({
      where: {
        fiscalYearId: workspace.fiscalYear.id,
        kind: filters.kind || undefined,
        status: filters.includeArchived ? undefined : { not: "ARCHIVED" },
      },
      orderBy: [{ status: "asc" }, { kind: "asc" }, { updatedAt: "desc" }],
    });
    return rows.map(toSummary);
  }

  async getWorkpaper(workspace: CompanyWorkspace, workpaperKey: string): Promise<ClosingWorkpaperSummary> {
    const row = await prisma.closingWorkpaper.findUnique({
      where: { fiscalYearId_workpaperKey: { fiscalYearId: workspace.fiscalYear.id, workpaperKey } },
    });
    if (!row) throw new ExpectedRouteError("Workpaper de clôture introuvable.", 404);
    return toSummary(row);
  }

  async saveWorkpaper(workspace: CompanyWorkspace, input: ClosingWorkpaperSaveInput): Promise<ClosingWorkpaperSummary> {
    const definition = definitionForKind(input.kind);
    const workpaperKey = normalizeWorkpaperKey(input.workpaperKey, input.kind, input.title || definition.title);
    const assumptions = normalizeAssumptions(input.kind, input.assumptions ?? {});
    const calculation = input.calculation ?? {};
    const status = input.status === "READY" ? "READY" : input.status === "ARCHIVED" ? "ARCHIVED" : "DRAFT";
    const existing = await prisma.closingWorkpaper.findUnique({
      where: { fiscalYearId_workpaperKey: { fiscalYearId: workspace.fiscalYear.id, workpaperKey } },
    });
    const row = await prisma.closingWorkpaper.upsert({
      where: { fiscalYearId_workpaperKey: { fiscalYearId: workspace.fiscalYear.id, workpaperKey } },
      create: {
        fiscalYearId: workspace.fiscalYear.id,
        workpaperKey,
        kind: input.kind,
        status,
        title: input.title?.trim() || definition.title,
        sourceEntityType: nullable(input.sourceEntityType),
        sourceEntityId: nullable(input.sourceEntityId),
        assumptionsJson: assumptions as Prisma.InputJsonValue,
        calculationJson: calculation as Prisma.InputJsonValue,
        note: nullable(input.note),
      },
      update: {
        kind: input.kind,
        status,
        title: input.title?.trim() || definition.title,
        sourceEntityType: nullable(input.sourceEntityType),
        sourceEntityId: nullable(input.sourceEntityId),
        assumptionsJson: assumptions as Prisma.InputJsonValue,
        calculationJson: calculation as Prisma.InputJsonValue,
        note: nullable(input.note),
      },
    });
    await this.activity.recordActivity(workspace, {
      action: existing ? "closing_workpaper.updated" : "closing_workpaper.created",
      entityType: "closing_workpaper",
      entityId: row.workpaperKey,
      metadata: { kind: row.kind, title: row.title, status: row.status },
    });
    return toSummary(row);
  }

  async archiveWorkpaper(workspace: CompanyWorkspace, workpaperKey: string): Promise<ClosingWorkpaperSummary> {
    const workpaper = await this.getWorkpaper(workspace, workpaperKey);
    const row = await prisma.closingWorkpaper.update({
      where: { fiscalYearId_workpaperKey: { fiscalYearId: workspace.fiscalYear.id, workpaperKey } },
      data: { status: "ARCHIVED" },
    });
    await this.activity.recordActivity(workspace, {
      action: "closing_workpaper.archived",
      entityType: "closing_workpaper",
      entityId: workpaper.workpaperKey,
      metadata: { kind: workpaper.kind, title: workpaper.title },
    });
    return toSummary(row);
  }

  async generateProposalsFromWorkpapers(workspace: CompanyWorkspace): Promise<{
    generated: number;
    skipped: number;
    proposals: ClosingAdjustmentDraftBuildResult[];
  }> {
    const workpapers = await this.listWorkpapers(workspace);
    const workpaperDrafts = workpapers
      .filter((workpaper) => workpaper.status !== "ARCHIVED")
      .map((workpaper) => buildGeneralClosingDraft({
        workpaperKey: workpaper.workpaperKey,
        kind: workpaper.kind,
        title: workpaper.title,
        assumptions: workpaper.assumptions,
        calculation: workpaper.calculation,
        sourceEntityType: workpaper.sourceEntityType,
        sourceEntityId: workpaper.sourceEntityId,
      }))
      .filter((draft): draft is ClosingAdjustmentDraftBuildResult => Boolean(draft));
    const [vatDraft, reconciliationDrafts] = await Promise.all([
      this.vatSettlement.previewSettlementProposal(workspace).catch(() => null),
      this.reconciliationAdjustments.listAdjustmentDrafts(workspace).catch(() => []),
    ]);
    const drafts = [...workpaperDrafts, ...(vatDraft ? [vatDraft] : []), ...reconciliationDrafts];

    let generated = 0;
    let skipped = 0;
    for (const draft of drafts) {
      const existing = await prisma.closingAdjustmentProposal.findUnique({
        where: { fiscalYearId_proposalKey: { fiscalYearId: workspace.fiscalYear.id, proposalKey: draft.proposalKey } },
      });
      if (existing?.status === "APPROVED" || existing?.status === "REJECTED") {
        skipped += 1;
        continue;
      }
      const row = await prisma.closingAdjustmentProposal.upsert({
        where: { fiscalYearId_proposalKey: { fiscalYearId: workspace.fiscalYear.id, proposalKey: draft.proposalKey } },
        create: {
          fiscalYearId: workspace.fiscalYear.id,
          issueKey: draft.issueKey,
          proposalKey: draft.proposalKey,
          kind: draft.kind,
          label: draft.label,
          assumptionsJson: (draft.assumptions ?? {}) as Prisma.InputJsonValue,
          calculationJson: draft.calculation as Prisma.InputJsonValue,
          linesJson: draft.lines as Prisma.InputJsonValue,
          lastCalculatedAt: new Date(),
        },
        update: {
          issueKey: draft.issueKey,
          kind: draft.kind,
          label: draft.label,
          assumptionsJson: (draft.assumptions ?? {}) as Prisma.InputJsonValue,
          calculationJson: draft.calculation as Prisma.InputJsonValue,
          linesJson: draft.lines as Prisma.InputJsonValue,
          staleReason: null,
          lastCalculatedAt: new Date(),
        },
      });
      await prisma.closingAdjustmentEvent.create({
        data: {
          proposalId: row.id,
          eventType: existing ? "proposal.recalculated" : "proposal.proposed",
          createdByUserId: workspace.user.id,
          payloadJson: { kind: draft.kind, workpaperKey: draft.workpaperKey } as Prisma.InputJsonValue,
        },
      });
      generated += 1;
      await this.activity.recordActivity(workspace, {
        action: existing ? "closing_adjustment.ready_for_review" : "closing_adjustment.generated",
        entityType: "closing_adjustment",
        entityId: draft.proposalKey,
        metadata: { kind: draft.kind, label: draft.label, workpaperKey: draft.workpaperKey },
      });
    }
    return { generated, skipped, proposals: drafts };
  }

  async summarizeWorkpapers(workspace: CompanyWorkspace): Promise<ClosingWorkpaperSummaryState> {
    const [workpapers, proposals, requiredEvidenceMissing] = await Promise.all([
      prisma.closingWorkpaper.findMany({ where: { fiscalYearId: workspace.fiscalYear.id } }),
      prisma.closingAdjustmentProposal.findMany({ where: { fiscalYearId: workspace.fiscalYear.id } }),
      this.countRequiredEvidenceMissing(workspace),
    ]);
    return {
      total: workpapers.filter((workpaper) => workpaper.status !== "ARCHIVED").length,
      draft: workpapers.filter((workpaper) => workpaper.status === "DRAFT").length,
      ready: workpapers.filter((workpaper) => workpaper.status === "READY").length,
      archived: workpapers.filter((workpaper) => workpaper.status === "ARCHIVED").length,
      proposals: {
        draft: proposals.filter((proposal) => proposal.status === "DRAFT").length,
        approved: proposals.filter((proposal) => proposal.status === "APPROVED").length,
        rejected: proposals.filter((proposal) => proposal.status === "REJECTED").length,
      },
      requiredEvidenceMissing,
    };
  }

  async getAvailableKinds() {
    return CLOSING_KIND_DEFINITIONS;
  }

  private async countRequiredEvidenceMissing(workspace: CompanyWorkspace) {
    const proposals = await prisma.closingAdjustmentProposal.findMany({
      where: { fiscalYearId: workspace.fiscalYear.id, status: "DRAFT" },
    });
    const required = proposals.filter((proposal) => asRecord(proposal.calculationJson).requiredEvidence === true);
    if (required.length === 0) return 0;
    const linked = await prisma.attachmentLink.findMany({
      where: {
        entityType: "CLOSING_ADJUSTMENT",
        entityId: { in: required.flatMap((proposal) => [proposal.id, proposal.proposalKey]) },
        attachment: { fiscalYearId: workspace.fiscalYear.id, archivedAt: null },
      },
      select: { entityId: true },
    });
    const linkedIds = new Set(linked.map((link) => link.entityId));
    return required.filter((proposal) => !linkedIds.has(proposal.id) && !linkedIds.has(proposal.proposalKey)).length;
  }
}

function toSummary(row: {
  id: string;
  workpaperKey: string;
  kind: string;
  status: string;
  title: string;
  sourceEntityType: string | null;
  sourceEntityId: string | null;
  assumptionsJson: unknown;
  calculationJson: unknown;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ClosingWorkpaperSummary {
  return {
    id: row.id,
    workpaperKey: row.workpaperKey,
    kind: row.kind,
    status: row.status,
    title: row.title,
    sourceEntityType: row.sourceEntityType,
    sourceEntityId: row.sourceEntityId,
    assumptions: asRecord(row.assumptionsJson),
    calculation: asRecord(row.calculationJson),
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function normalizeAssumptions(kind: string, assumptions: Record<string, unknown>) {
  const definition = definitionForKind(kind);
  return cleanRecord({
    amount: numberValue(assumptions.amount, definition.defaultAmount),
    debitAccount: stringValue(assumptions.debitAccount, definition.defaultDebitAccount),
    creditAccount: stringValue(assumptions.creditAccount, definition.defaultCreditAccount),
    basis: stringValue(assumptions.basis, definition.description),
    requiredEvidence: booleanValue(assumptions.requiredEvidence, definition.requiredEvidence),
    initialStock: maybeNumber(assumptions.initialStock),
    finalStock: maybeNumber(assumptions.finalStock),
    capital: maybeNumber(assumptions.capital),
    annualRate: maybeNumber(assumptions.annualRate),
    days: maybeNumber(assumptions.days),
  });
}

function normalizeWorkpaperKey(input: string | null | undefined, kind: string, title: string) {
  const raw = (input || `${kind}:${title}`).trim();
  return raw.replace(/[^a-zA-Z0-9:_-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 120);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function nullable(value: string | null | undefined) {
  const clean = value?.trim();
  return clean ? clean : null;
}

function numberValue(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function maybeNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = numberValue(value, NaN);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function booleanValue(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true" || value === "on" || value === "1";
  return fallback;
}

function cleanRecord(input: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

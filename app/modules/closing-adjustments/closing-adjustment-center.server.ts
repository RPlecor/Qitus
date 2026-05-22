import { type ClosingAdjustmentKind, type ClosingAdjustmentStatus, Prisma } from "@prisma/client";
import Decimal from "decimal.js";
import { ActivityLogCenter } from "../activity-log/activity-log-center.server";
import { AccountingIssueTracker, type AccountingIssueSummary } from "../accounting-issues/accounting-issue-tracker.server";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { ExpectedRouteError } from "../route-errors.server";
import { generalAssumptionsForDraft, recalculateGeneralClosingDraft } from "../closing-workpapers/general-closing-calculators.server";

export type ClosingAdjustmentLine = {
  account: string;
  accountLabel?: string;
  debit: number;
  credit: number;
};

export type ClosingAdjustmentDraft = {
  issueKey: string;
  proposalKey: string;
  kind: ClosingAdjustmentKind;
  label: string;
  calculation: Record<string, unknown>;
  assumptions?: Record<string, unknown>;
  lines: ClosingAdjustmentLine[];
};

export type ClosingAdjustmentSummary = ClosingAdjustmentDraft & {
  id: string;
  status: ClosingAdjustmentStatus;
  assumptions: Record<string, unknown>;
  note: string | null;
  journalEntryId: string | null;
  calculationVersion: number;
  lastCalculatedAt: string | null;
  staleReason: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
};

export type ClosingAdjustmentStateSummary = {
  draft: number;
  approved: number;
  rejected: number;
};

export type ClosingAdjustmentAuditEvent = {
  id: string;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
  createdByUserId: string | null;
};

export class ClosingAdjustmentCenter {
  constructor(
    private readonly issueTracker = new AccountingIssueTracker(),
    private readonly activity = new ActivityLogCenter()
  ) {}

  async listProposals(workspace: CompanyWorkspace): Promise<ClosingAdjustmentSummary[]> {
    await this.syncDraftProposals(workspace);
    const rows = await prisma.closingAdjustmentProposal.findMany({
      where: { fiscalYearId: workspace.fiscalYear.id },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    });
    return rows.map(toSummary);
  }

  async getProposal(workspace: CompanyWorkspace, proposalKey: string): Promise<ClosingAdjustmentSummary> {
    await this.syncDraftProposals(workspace);
    const row = await prisma.closingAdjustmentProposal.findUnique({
      where: { fiscalYearId_proposalKey: { fiscalYearId: workspace.fiscalYear.id, proposalKey } },
    });
    if (!row) throw new ExpectedRouteError("Proposition OD introuvable.", 404);
    return toSummary(row);
  }

  async previewProposal(workspace: CompanyWorkspace, issueKey: string): Promise<ClosingAdjustmentSummary> {
    const proposal = (await this.listProposals(workspace)).find((candidate) => candidate.issueKey === issueKey);
    if (!proposal) throw new ExpectedRouteError("Aucune OD déterministe n'est disponible pour ce point.", 404);
    return proposal;
  }

  async saveProposalAssumptions(
    workspace: CompanyWorkspace,
    input: { proposalKey: string; assumptions: Record<string, unknown> }
  ): Promise<ClosingAdjustmentSummary> {
    const proposal = await this.getProposal(workspace, input.proposalKey);
    assertDraftEditable(proposal);
    const assumptions = normalizeAssumptions(proposal, input.assumptions);
    const updated = await prisma.closingAdjustmentProposal.update({
      where: { fiscalYearId_proposalKey: { fiscalYearId: workspace.fiscalYear.id, proposalKey: input.proposalKey } },
      data: {
        assumptionsJson: assumptions as Prisma.InputJsonValue,
        staleReason: "Hypothèses modifiées, recalcul recommandé.",
      },
    });
    await this.recordProposalEvent(workspace, updated.id, "assumptions.updated", { assumptions });
    await this.activity.recordActivity(workspace, {
      action: "closing_adjustment.assumptions_updated",
      entityType: "closing_adjustment",
      entityId: proposal.proposalKey,
      metadata: { kind: proposal.kind, label: proposal.label },
    });
    return toSummary(updated);
  }

  async recalculateProposal(workspace: CompanyWorkspace, proposalKey: string): Promise<ClosingAdjustmentSummary> {
    const proposal = await this.getProposal(workspace, proposalKey);
    assertDraftEditable(proposal);
    const resultBeforeTax = proposal.kind === "CORPORATE_TAX" ? await computeResultBeforeTax(workspace.fiscalYear.id) : 0;
    const next = recalculateDraft(proposal, workspace.fiscalYear.endDate, resultBeforeTax);
    const updated = await prisma.closingAdjustmentProposal.update({
      where: { fiscalYearId_proposalKey: { fiscalYearId: workspace.fiscalYear.id, proposalKey } },
      data: {
        assumptionsJson: next.assumptions as Prisma.InputJsonValue,
        calculationJson: next.calculation as Prisma.InputJsonValue,
        linesJson: next.lines as Prisma.InputJsonValue,
        calculationVersion: { increment: 1 },
        lastCalculatedAt: new Date(),
        staleReason: null,
      },
    });
    await this.recordProposalEvent(workspace, updated.id, "proposal.recalculated", {
      calculation: next.calculation,
      lines: next.lines,
    });
    await this.activity.recordActivity(workspace, {
      action: "closing_adjustment.recalculated",
      entityType: "closing_adjustment",
      entityId: proposal.proposalKey,
      metadata: { kind: proposal.kind, label: proposal.label },
    });
    return toSummary(updated);
  }

  async approveProposal(workspace: CompanyWorkspace, proposalKey: string): Promise<ClosingAdjustmentSummary> {
    const proposal = await this.getProposal(workspace, proposalKey);
    if (proposal.status === "APPROVED") return proposal;
    if (proposal.status === "REJECTED") throw new ExpectedRouteError("Cette proposition a été rejetée. Réouvre-la avant validation.", 409);
    if (proposal.staleReason) throw new ExpectedRouteError("Recalcule l'OD avant de la valider.", 409);
    assertBalanced(proposal.lines);

    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.closingAdjustmentProposal.findUniqueOrThrow({
        where: { fiscalYearId_proposalKey: { fiscalYearId: workspace.fiscalYear.id, proposalKey } },
      });
      if (current.status === "APPROVED") return current;
      if (current.staleReason) throw new ExpectedRouteError("Recalcule l'OD avant de la valider.", 409);

      const maxEntry = await tx.journalEntry.findFirst({
        where: { fiscalYearId: workspace.fiscalYear.id },
        orderBy: { num: "desc" },
      });
      const journalEntry = await tx.journalEntry.create({
        data: {
          fiscalYearId: workspace.fiscalYear.id,
          num: (maxEntry?.num ?? 0) + 1,
          date: workspace.fiscalYear.endDate,
          journal: "OD",
          ref: proposal.proposalKey,
          label: proposal.label,
          source: "CLOSING_ADJUSTMENT",
          lines: {
            create: proposal.lines.map((line) => ({
              account: line.account,
              accountLabel: line.accountLabel,
              debit: line.debit,
              credit: line.credit,
            })),
          },
        },
      });

      await tx.accountingIssueResolution.upsert({
        where: { fiscalYearId_issueKey: { fiscalYearId: workspace.fiscalYear.id, issueKey: proposal.issueKey } },
        update: { status: "RESOLVED", resolvedAt: new Date(), ignoredAt: null },
        create: {
          fiscalYearId: workspace.fiscalYear.id,
          issueKey: proposal.issueKey,
          controlCode: controlCodeForKind(proposal.kind),
          status: "RESOLVED",
          resolvedAt: new Date(),
        },
      });

      const approved = await tx.closingAdjustmentProposal.update({
        where: { id: current.id },
        data: {
          status: "APPROVED",
          journalEntryId: journalEntry.id,
          approvedAt: new Date(),
          approvedByUserId: workspace.user.id,
          rejectedAt: null,
          rejectedByUserId: null,
        },
      });

      await tx.closingAdjustmentEvent.create({
        data: {
          proposalId: current.id,
          eventType: "proposal.approved",
          createdByUserId: workspace.user.id,
          payloadJson: { journalEntryId: journalEntry.id } as Prisma.InputJsonValue,
        },
      });

      return approved;
    });

    await this.activity.recordActivity(workspace, {
      action: "closing_adjustment.approved",
      entityType: "closing_adjustment",
      entityId: proposal.proposalKey,
      metadata: { kind: proposal.kind, label: proposal.label },
    });
    await this.activity.recordActivity(workspace, {
      action: "document.marked_stale",
      entityType: "document",
      entityId: workspace.fiscalYear.id,
      metadata: { reason: "closing_adjustment.approved", proposalKey: proposal.proposalKey },
    });

    return toSummary(updated);
  }

  async rejectProposal(workspace: CompanyWorkspace, proposalKey: string, note?: string | null): Promise<ClosingAdjustmentSummary> {
    const proposal = await this.getProposal(workspace, proposalKey);
    if (proposal.status === "APPROVED") throw new ExpectedRouteError("Une OD déjà validée ne peut pas être rejetée.", 409);
    const updated = await prisma.closingAdjustmentProposal.update({
      where: { fiscalYearId_proposalKey: { fiscalYearId: workspace.fiscalYear.id, proposalKey } },
      data: { status: "REJECTED", note: normalizeNote(note), rejectedAt: new Date(), rejectedByUserId: workspace.user.id },
    });
    await this.recordProposalEvent(workspace, updated.id, "proposal.rejected", { note: normalizeNote(note) });
    await this.activity.recordActivity(workspace, {
      action: "closing_adjustment.rejected",
      entityType: "closing_adjustment",
      entityId: proposal.proposalKey,
      metadata: { kind: proposal.kind, label: proposal.label, note: normalizeNote(note) },
    });
    return toSummary(updated);
  }

  async getProposalAuditTrail(workspace: CompanyWorkspace, proposalKey: string): Promise<ClosingAdjustmentAuditEvent[]> {
    const proposal = await this.getProposal(workspace, proposalKey);
    const rows = await prisma.closingAdjustmentEvent.findMany({
      where: { proposalId: proposal.id },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => ({
      id: row.id,
      eventType: row.eventType,
      payload: asRecord(row.payloadJson),
      createdAt: row.createdAt.toISOString(),
      createdByUserId: row.createdByUserId,
    }));
  }

  async summarizeClosingAdjustments(workspace: CompanyWorkspace): Promise<ClosingAdjustmentStateSummary> {
    const proposals = await this.listProposals(workspace);
    return {
      draft: proposals.filter((proposal) => proposal.status === "DRAFT").length,
      approved: proposals.filter((proposal) => proposal.status === "APPROVED").length,
      rejected: proposals.filter((proposal) => proposal.status === "REJECTED").length,
    };
  }

  private async syncDraftProposals(workspace: CompanyWorkspace) {
    const [issues, existing, resultBeforeTax] = await Promise.all([
      this.issueTracker.listIssues(workspace),
      prisma.closingAdjustmentProposal.findMany({ where: { fiscalYearId: workspace.fiscalYear.id } }),
      computeResultBeforeTax(workspace.fiscalYear.id),
    ]);
    const existingByKey = new Map(existing.map((proposal) => [proposal.proposalKey, proposal]));
    const drafts = [
      ...issues.flatMap((issue) => proposalForIssue(issue, workspace.fiscalYear.endDate)),
      ...corporateTaxProposal(workspace.fiscalYear.id, resultBeforeTax),
    ];

    for (const draft of drafts) {
      const previous = existingByKey.get(draft.proposalKey);
      if (previous?.status === "APPROVED" || previous?.status === "REJECTED") continue;
      if (previous?.assumptionsJson) continue;
      const assumptions = draft.assumptions ?? assumptionsForDraft(draft);
      const row = await prisma.closingAdjustmentProposal.upsert({
        where: { fiscalYearId_proposalKey: { fiscalYearId: workspace.fiscalYear.id, proposalKey: draft.proposalKey } },
        update: {
          issueKey: draft.issueKey,
          kind: draft.kind,
          label: draft.label,
          assumptionsJson: assumptions as Prisma.InputJsonValue,
          calculationJson: draft.calculation as Prisma.InputJsonValue,
          linesJson: draft.lines as Prisma.InputJsonValue,
        },
        create: {
          fiscalYearId: workspace.fiscalYear.id,
          issueKey: draft.issueKey,
          proposalKey: draft.proposalKey,
          kind: draft.kind,
          label: draft.label,
          assumptionsJson: assumptions as Prisma.InputJsonValue,
          calculationJson: draft.calculation as Prisma.InputJsonValue,
          linesJson: draft.lines as Prisma.InputJsonValue,
          lastCalculatedAt: new Date(),
        },
      });
      if (!previous) {
        await this.recordProposalEvent(workspace, row.id, "proposal.proposed", { kind: row.kind, label: row.label });
        await this.activity.recordActivity(workspace, {
          action: "closing_adjustment.proposed",
          entityType: "closing_adjustment",
          entityId: row.proposalKey,
          metadata: { kind: row.kind, label: row.label },
        });
      }
    }
  }

  private async recordProposalEvent(
    workspace: CompanyWorkspace,
    proposalId: string,
    eventType: string,
    payload: Record<string, unknown>
  ) {
    await prisma.closingAdjustmentEvent.create({
      data: {
        proposalId,
        eventType,
        createdByUserId: workspace.user.id,
        payloadJson: payload as Prisma.InputJsonValue,
      },
    });
  }
}

export function proposalForIssue(issue: AccountingIssueSummary, fiscalYearEnd: Date): ClosingAdjustmentDraft[] {
  if (issue.status !== "OPEN" && issue.status !== "RESOLVED") return [];
  if (issue.controlCode === "ANNUAL_CHARGE_CCA") return ccaProposal(issue);
  if (issue.controlCode === "FIXED_ASSET_CANDIDATE") return depreciationProposal(issue, fiscalYearEnd);
  return [];
}

export function ccaProposal(issue: AccountingIssueSummary): ClosingAdjustmentDraft[] {
  const label = issue.evidence.label ?? "";
  const account = issue.evidence.account ?? "";
  const known = knownCca(label);
  if (!known || !account) return [];
  const draft: ClosingAdjustmentDraft = {
    issueKey: issue.issueKey,
    proposalKey: proposalKey("CCA", issue.issueKey),
    kind: "CCA",
    label: known.label,
    calculation: {
      source: "fixture-mvp",
      totalAmount: Math.abs(Number(issue.evidence.amount ?? 0)),
      nextExerciseAmount: known.amount,
      period: known.period,
    },
    lines: [
      { account: "486", accountLabel: "Charges constatées d'avance", debit: known.amount, credit: 0 },
      { account, debit: 0, credit: known.amount },
    ],
  };
  return [{ ...draft, assumptions: assumptionsForDraft(draft) }];
}

export function depreciationProposal(issue: AccountingIssueSummary, fiscalYearEnd: Date): ClosingAdjustmentDraft[] {
  const label = issue.evidence.label ?? "";
  if (!/macbook/i.test(label)) return [];
  const draft: ClosingAdjustmentDraft = {
    issueKey: issue.issueKey,
    proposalKey: proposalKey("DEPRECIATION", issue.issueKey),
    kind: "DEPRECIATION",
    label: "Dotation amortissement MacBook Pro M3 - exercice 2025",
    calculation: {
      source: "fixture-mvp",
      acquisitionDate: issue.evidence.date,
      fiscalYearEnd: fiscalYearEnd.toISOString().slice(0, 10),
      baseAmount: Math.abs(Number(issue.evidence.amount ?? 0)),
      usefulLifeYears: 3,
      prorataDays: 325,
      depreciationAmount: 563.89,
    },
    lines: [
      { account: "68112", accountLabel: "Dotations aux amortissements corporels", debit: 563.89, credit: 0 },
      { account: "28183", accountLabel: "Amortissements du matériel de bureau", debit: 0, credit: 563.89 },
    ],
  };
  return [{ ...draft, assumptions: assumptionsForDraft(draft) }];
}

export function corporateTaxProposal(fiscalYearId: string, resultBeforeTax: number): ClosingAdjustmentDraft[] {
  if (resultBeforeTax <= 0) return [];
  const tax = money(new Decimal(resultBeforeTax).times(0.15).toNumber());
  if (tax <= 0) return [];
  const issueKey = `CORPORATE_TAX:fiscal-year:${fiscalYearId}`;
  const draft: ClosingAdjustmentDraft = {
    issueKey,
    proposalKey: proposalKey("CORPORATE_TAX", issueKey),
    kind: "CORPORATE_TAX",
    label: "Impôt sur les sociétés - exercice 2025",
    calculation: {
      source: "mvp-deterministic",
      resultBeforeTax,
      rate: 0.15,
      tax,
    },
    lines: [
      { account: "695", accountLabel: "Impôts sur les bénéfices", debit: tax, credit: 0 },
      { account: "444", accountLabel: "État - impôts sur les bénéfices", debit: 0, credit: tax },
    ],
  };
  return [{ ...draft, assumptions: assumptionsForDraft(draft) }];
}

export function recalculateDraft(
  proposal: ClosingAdjustmentSummary,
  fiscalYearEnd: Date,
  resultBeforeTax: number
): Pick<ClosingAdjustmentDraft, "assumptions" | "calculation" | "lines"> {
  const assumptions = normalizeAssumptions(proposal, {});
  if (proposal.kind === "CCA") {
    const amount = money(numberValue(assumptions.nextExerciseAmount, 0));
    const period = stringValue(assumptions.period, "");
    const chargeAccount = stringValue(assumptions.chargeAccount, "6");
    const prepaidExpenseAccount = stringValue(assumptions.prepaidExpenseAccount, "486");
    return {
      assumptions,
      calculation: {
        source: "user-assumptions",
        totalAmount: numberValue(proposal.calculation.totalAmount, 0),
        nextExerciseAmount: amount,
        period,
      },
      lines: [
        { account: prepaidExpenseAccount, accountLabel: prepaidExpenseAccount === "486" ? "Charges constatées d'avance" : undefined, debit: amount, credit: 0 },
        { account: chargeAccount, debit: 0, credit: amount },
      ],
    };
  }
  if (proposal.kind === "DEPRECIATION") {
    const baseAmount = numberValue(assumptions.baseAmount, 0);
    const usefulLifeYears = Math.max(numberValue(assumptions.usefulLifeYears, 1), 1);
    const prorataDays = Math.max(numberValue(assumptions.prorataDays, 365), 0);
    const depreciationAmount = money(new Decimal(baseAmount).div(usefulLifeYears).times(prorataDays).div(365).toNumber());
    const expenseAccount = stringValue(assumptions.expenseAccount, "68112");
    const depreciationAccount = stringValue(assumptions.depreciationAccount, "28183");
    return {
      assumptions,
      calculation: {
        source: "user-assumptions",
        acquisitionDate: stringValue(assumptions.acquisitionDate, ""),
        fiscalYearEnd: fiscalYearEnd.toISOString().slice(0, 10),
        baseAmount,
        usefulLifeYears,
        prorataDays,
        depreciationAmount,
      },
      lines: [
        { account: expenseAccount, accountLabel: "Dotations aux amortissements corporels", debit: depreciationAmount, credit: 0 },
        { account: depreciationAccount, accountLabel: "Amortissements du matériel de bureau", debit: 0, credit: depreciationAmount },
      ],
    };
  }
  if (proposal.kind !== "CORPORATE_TAX") {
    return recalculateGeneralClosingDraft({
      kind: proposal.kind,
      label: proposal.label,
      issueKey: proposal.issueKey,
      proposalKey: proposal.proposalKey,
      assumptions,
      calculation: proposal.calculation,
      lines: proposal.lines,
    });
  }
  const rate = numberValue(assumptions.rate, 0.15);
  const tax = money(new Decimal(resultBeforeTax).times(rate).toNumber());
  const taxAssumptions = { ...assumptions, resultBeforeTax };
  return {
    assumptions: taxAssumptions,
    calculation: {
      source: "user-assumptions",
      resultBeforeTax,
      rate,
      tax,
    },
    lines: [
      { account: stringValue(assumptions.expenseAccount, "695"), accountLabel: "Impôts sur les bénéfices", debit: tax, credit: 0 },
      { account: stringValue(assumptions.payableAccount, "444"), accountLabel: "État - impôts sur les bénéfices", debit: 0, credit: tax },
    ],
  };
}

function normalizeAssumptions(proposal: ClosingAdjustmentSummary, next: Record<string, unknown>): Record<string, unknown> {
  const current: Record<string, unknown> = { ...assumptionsForDraft(proposal), ...proposal.assumptions, ...next };
  if (proposal.kind === "CCA") {
    return {
      period: stringValue(current.period, ""),
      nextExerciseAmount: money(numberValue(current.nextExerciseAmount, 0)),
      chargeAccount: stringValue(current.chargeAccount, stringValue(proposal.lines[1]?.account, "")),
      prepaidExpenseAccount: stringValue(current.prepaidExpenseAccount, "486"),
    };
  }
  if (proposal.kind === "DEPRECIATION") {
    return {
      acquisitionDate: stringValue(current.acquisitionDate, ""),
      baseAmount: money(numberValue(current.baseAmount, 0)),
      usefulLifeYears: numberValue(current.usefulLifeYears, 3),
      prorataDays: numberValue(current.prorataDays, 365),
      expenseAccount: stringValue(current.expenseAccount, "68112"),
      depreciationAccount: stringValue(current.depreciationAccount, "28183"),
    };
  }
  if (proposal.kind !== "CORPORATE_TAX") {
    return {
      ...generalAssumptionsForDraft(proposal),
      ...current,
      amount: money(numberValue(current.amount, numberValue(proposal.calculation.amount, proposal.lines.reduce((sum, line) => sum + line.debit, 0)))),
      debitAccount: stringValue(current.debitAccount, stringValue(proposal.lines.find((line) => line.debit > 0)?.account, "")),
      creditAccount: stringValue(current.creditAccount, stringValue(proposal.lines.find((line) => line.credit > 0)?.account, "")),
      basis: stringValue(current.basis, stringValue(proposal.calculation.basis, "")),
      requiredEvidence: booleanValue(current.requiredEvidence, Boolean(proposal.calculation.requiredEvidence)),
      initialStock: optionalNumber(current.initialStock),
      finalStock: optionalNumber(current.finalStock),
      capital: optionalNumber(current.capital),
      annualRate: optionalNumber(current.annualRate),
      days: optionalNumber(current.days),
    };
  }
  return {
    resultBeforeTax: numberValue(current.resultBeforeTax, numberValue(proposal.calculation.resultBeforeTax, 0)),
    rate: numberValue(current.rate, 0.15),
    expenseAccount: stringValue(current.expenseAccount, "695"),
    payableAccount: stringValue(current.payableAccount, "444"),
  };
}

export function assumptionsForDraft(draft: Pick<ClosingAdjustmentDraft, "kind" | "calculation" | "lines">) {
  if (draft.kind === "CCA") {
    return {
      period: stringValue(draft.calculation.period, ""),
      nextExerciseAmount: money(numberValue(draft.calculation.nextExerciseAmount, 0)),
      chargeAccount: stringValue(draft.lines[1]?.account, ""),
      prepaidExpenseAccount: stringValue(draft.lines[0]?.account, "486"),
    };
  }
  if (draft.kind === "DEPRECIATION") {
    return {
      acquisitionDate: stringValue(draft.calculation.acquisitionDate, ""),
      baseAmount: money(numberValue(draft.calculation.baseAmount, 0)),
      usefulLifeYears: numberValue(draft.calculation.usefulLifeYears, 3),
      prorataDays: numberValue(draft.calculation.prorataDays, 365),
      expenseAccount: stringValue(draft.lines[0]?.account, "68112"),
      depreciationAccount: stringValue(draft.lines[1]?.account, "28183"),
    };
  }
  if (draft.kind !== "CORPORATE_TAX") {
    return generalAssumptionsForDraft(draft);
  }
  return {
    resultBeforeTax: numberValue(draft.calculation.resultBeforeTax, 0),
    rate: numberValue(draft.calculation.rate, 0.15),
    expenseAccount: stringValue(draft.lines[0]?.account, "695"),
    payableAccount: stringValue(draft.lines[1]?.account, "444"),
  };
}

function toSummary(row: {
  id: string;
  issueKey: string;
  proposalKey: string;
  kind: ClosingAdjustmentKind;
  status: ClosingAdjustmentStatus;
  label: string;
  assumptionsJson: unknown;
  calculationJson: unknown;
  linesJson: unknown;
  calculationVersion: number;
  lastCalculatedAt: Date | null;
  staleReason: string | null;
  note: string | null;
  journalEntryId: string | null;
  approvedAt: Date | null;
  rejectedAt: Date | null;
}): ClosingAdjustmentSummary {
  const base = {
    id: row.id,
    issueKey: row.issueKey,
    proposalKey: row.proposalKey,
    kind: row.kind,
    status: row.status,
    label: row.label,
    calculation: asRecord(row.calculationJson),
    lines: asLines(row.linesJson),
    assumptions: asRecord(row.assumptionsJson),
    note: row.note,
    journalEntryId: row.journalEntryId,
    calculationVersion: row.calculationVersion,
    lastCalculatedAt: row.lastCalculatedAt?.toISOString() ?? null,
    staleReason: row.staleReason,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    rejectedAt: row.rejectedAt?.toISOString() ?? null,
  };
  return { ...base, assumptions: Object.keys(base.assumptions).length > 0 ? base.assumptions : assumptionsForDraft(base) };
}

async function computeResultBeforeTax(fiscalYearId: string) {
  const lines = await prisma.journalLine.findMany({
    where: { journalEntry: { fiscalYearId } },
    select: { account: true, debit: true, credit: true },
  });
  return lines.reduce((total, line) => {
    if (line.account === "695" || line.account === "444") return total;
    if (line.account.startsWith("7")) return total + Number(line.credit) - Number(line.debit);
    if (line.account.startsWith("6")) return total - Number(line.debit) + Number(line.credit);
    return total;
  }, 0);
}

function knownCca(label: string) {
  if (/assurance|axa|rc pro/i.test(label)) return { amount: 40.27, label: "CCA - assurance RC Pro AXA", period: "2026-01-01/2026-01-27" };
  if (/canva/i.test(label)) return { amount: 1.57, label: "CCA - Canva Pro", period: "2026-01-01/2026-01-16" };
  return null;
}

function proposalKey(kind: string, issueKey: string) {
  return `${kind}:${issueKey}`;
}

function controlCodeForKind(kind: ClosingAdjustmentKind) {
  if (kind === "CCA") return "ANNUAL_CHARGE_CCA";
  if (kind === "DEPRECIATION") return "FIXED_ASSET_CANDIDATE";
  if (kind === "FNP" || kind === "FAE" || kind === "PCA") return "ACCRUALS_CLOSING";
  if (kind === "STOCK_VARIATION") return "INVENTORY_CLOSING";
  if (kind === "PROVISION" || kind === "PROVISION_REVERSAL") return "PROVISION_CLOSING";
  if (kind === "LOAN_INTEREST_ACCRUAL") return "LOAN_CLOSING";
  if (kind === "PAYROLL_ACCRUAL") return "PAYROLL_CLOSING";
  if (kind === "VAT_SETTLEMENT") return "VAT_SETTLEMENT";
  if (kind === "RECONCILIATION_DIFFERENCE") return "RECONCILIATION_DIFFERENCE";
  return "CORPORATE_TAX";
}

function assertDraftEditable(proposal: ClosingAdjustmentSummary) {
  if (proposal.status !== "DRAFT") throw new ExpectedRouteError("Une OD validée ou rejetée n'est plus modifiable.", 409);
}

function assertBalanced(lines: ClosingAdjustmentLine[]) {
  const debit = lines.reduce((sum, line) => sum.plus(line.debit), new Decimal(0));
  const credit = lines.reduce((sum, line) => sum.plus(line.credit), new Decimal(0));
  if (!debit.equals(credit)) throw new ExpectedRouteError("La proposition OD n'est pas équilibrée.", 422);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asLines(value: unknown): ClosingAdjustmentLine[] {
  return Array.isArray(value) ? value as ClosingAdjustmentLine[] : [];
}

function normalizeNote(note: string | null | undefined) {
  const clean = (note ?? "").trim();
  return clean.length > 0 ? clean : null;
}

function numberValue(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function optionalNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = numberValue(value, NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

function booleanValue(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true" || value === "on" || value === "1";
  return fallback;
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function money(value: number) {
  return new Decimal(value || 0).toDecimalPlaces(2).toNumber();
}

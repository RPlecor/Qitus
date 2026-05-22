import type { ReconciliationRunKind } from "@prisma/client";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { BankLineReconciliationCenter } from "./bank-line-reconciliation-center.server";
import { ReconciliationFreshnessCenter } from "./reconciliation-freshness-center.server";
import { StripeReconciliationCenter } from "./stripe-reconciliation-center.server";
import { SuspenseAccountCenter } from "./suspense-account-center.server";
import { ThirdPartyMatchingCenter } from "./third-party-matching-center.server";

export class ReconciliationReportCenter {
  constructor(
    private readonly freshness = new ReconciliationFreshnessCenter(),
    private readonly bank = new BankLineReconciliationCenter(),
    private readonly stripe = new StripeReconciliationCenter(),
    private readonly thirdParty = new ThirdPartyMatchingCenter(),
    private readonly suspense = new SuspenseAccountCenter()
  ) {}

  async buildBankReport(workspace: CompanyWorkspace) {
    const [run, freshness, reconciliation] = await Promise.all([
      this.runWithData(workspace, "BANK"),
      this.freshness.getRunFreshness(workspace, "BANK"),
      this.bank.getBankReconciliation(workspace),
    ]);
    return {
      kind: "BANK",
      freshness,
      run,
      balance: reconciliation.balance,
      stats: reconciliation.summary,
      matches: reconciliation.matches.map(serializeMatch),
      issues: run?.issues.map(serializeIssue) ?? [],
    };
  }

  async buildStripeReport(workspace: CompanyWorkspace) {
    const [run, freshness, summary, events] = await Promise.all([
      this.runWithData(workspace, "STRIPE"),
      this.freshness.getRunFreshness(workspace, "STRIPE"),
      this.stripe.summarizeStripeReconciliation(workspace),
      this.stripe.listStripeEvents(workspace),
    ]);
    return {
      kind: "STRIPE",
      freshness,
      run,
      stats: summary,
      events: events.map((event) => ({
        id: event.id,
        sourceId: event.sourceId,
        eventType: event.eventType,
        date: event.date.toISOString(),
        grossAmount: Number(event.grossAmount),
        feeAmount: Number(event.feeAmount),
        netAmount: Number(event.netAmount),
        payoutId: event.payoutId,
      })),
      matches: run?.matches.map(serializeMatch) ?? [],
      issues: run?.issues.map(serializeIssue) ?? [],
    };
  }

  async buildThirdPartyReport(workspace: CompanyWorkspace) {
    const [run, freshness, summary] = await Promise.all([
      this.runWithData(workspace, "THIRD_PARTY"),
      this.freshness.getRunFreshness(workspace, "THIRD_PARTY"),
      this.thirdParty.summarizeThirdPartyMatching(workspace),
    ]);
    return {
      kind: "THIRD_PARTY",
      freshness,
      run,
      stats: summary,
      matches: run?.matches.map(serializeMatch) ?? [],
      issues: run?.issues.map(serializeIssue) ?? [],
    };
  }

  async buildSuspenseReport(workspace: CompanyWorkspace) {
    const [run, freshness, summary] = await Promise.all([
      this.runWithData(workspace, "SUSPENSE"),
      this.freshness.getRunFreshness(workspace, "SUSPENSE"),
      this.suspense.summarizeSuspenseAccounts(workspace),
    ]);
    return {
      kind: "SUSPENSE",
      freshness,
      run,
      stats: summary,
      matches: run?.matches.map(serializeMatch) ?? [],
      issues: run?.issues.map(serializeIssue) ?? [],
    };
  }

  async buildFullReport(workspace: CompanyWorkspace) {
    const [freshness, bank, stripe, thirdParty, suspense] = await Promise.all([
      this.freshness.getFreshness(workspace),
      this.buildBankReport(workspace),
      this.buildStripeReport(workspace),
      this.buildThirdPartyReport(workspace),
      this.buildSuspenseReport(workspace),
    ]);
    return {
      generatedAt: new Date().toISOString(),
      companyId: workspace.company.id,
      fiscalYearId: workspace.fiscalYear.id,
      freshness,
      bank,
      stripe,
      thirdParty,
      suspense,
    };
  }

  private async runWithData(workspace: CompanyWorkspace, kind: ReconciliationRunKind) {
    const run = await prisma.reconciliationRun.findUnique({
      where: { fiscalYearId_kind: { fiscalYearId: workspace.fiscalYear.id, kind } },
      include: { matches: true, issues: true },
    });
    if (!run) return null;
    return {
      id: run.id,
      kind: run.kind,
      status: run.status,
      startedAt: run.startedAt?.toISOString() ?? null,
      completedAt: run.completedAt?.toISOString() ?? null,
      updatedAt: run.updatedAt.toISOString(),
      metadataJson: run.metadataJson,
      matches: run.matches,
      issues: run.issues,
    };
  }
}

function serializeMatch(match: {
  id: string;
  kind: string;
  leftEntityType: string;
  leftEntityId: string;
  rightEntityType: string | null;
  rightEntityId: string | null;
  status: string;
  amountDifference: unknown;
  dateDifferenceDays: number;
  confidence: unknown;
  note: string | null;
  updatedAt: Date;
}) {
  return {
    id: match.id,
    kind: match.kind,
    leftEntityType: match.leftEntityType,
    leftEntityId: match.leftEntityId,
    rightEntityType: match.rightEntityType,
    rightEntityId: match.rightEntityId,
    status: match.status,
    amountDifference: Number(match.amountDifference),
    dateDifferenceDays: match.dateDifferenceDays,
    confidence: Number(match.confidence),
    note: match.note,
    updatedAt: match.updatedAt.toISOString(),
  };
}

function serializeIssue(issue: {
  id: string;
  issueKey: string;
  code: string;
  severity: string;
  status: string;
  entityType: string;
  entityId: string;
  note: string | null;
  updatedAt: Date;
}) {
  return {
    id: issue.id,
    issueKey: issue.issueKey,
    code: issue.code,
    severity: issue.severity,
    status: issue.status,
    entityType: issue.entityType,
    entityId: issue.entityId,
    note: issue.note,
    updatedAt: issue.updatedAt.toISOString(),
  };
}

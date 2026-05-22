import type { ReconciliationIssueSeverity, ReconciliationIssueStatus, ReconciliationRunKind } from "@prisma/client";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { ExpectedRouteError } from "../route-errors.server";
import { BankLineReconciliationCenter } from "./bank-line-reconciliation-center.server";
import { ReconciliationFreshnessCenter } from "./reconciliation-freshness-center.server";
import { StripeReconciliationCenter } from "./stripe-reconciliation-center.server";
import { SuspenseAccountCenter } from "./suspense-account-center.server";
import { ThirdPartyMatchingCenter } from "./third-party-matching-center.server";

export type ReconciliationReviewFilters = {
  kind?: ReconciliationRunKind | null;
  status?: ReconciliationIssueStatus | string | null;
  severity?: ReconciliationIssueSeverity | string | null;
  source?: string | null;
};

export class ReconciliationReviewWorkflow {
  constructor(
    private readonly bank = new BankLineReconciliationCenter(),
    private readonly stripe = new StripeReconciliationCenter(),
    private readonly thirdParty = new ThirdPartyMatchingCenter(),
    private readonly suspense = new SuspenseAccountCenter(),
    private readonly freshness = new ReconciliationFreshnessCenter()
  ) {}

  async getReviewQueue(workspace: CompanyWorkspace, filters: ReconciliationReviewFilters = {}) {
    await this.refresh(workspace);
    const issues = await prisma.reconciliationIssue.findMany({
      where: {
        run: { fiscalYearId: workspace.fiscalYear.id, ...(filters.kind ? { kind: filters.kind as ReconciliationRunKind } : {}) },
        ...(filters.status ? { status: filters.status as ReconciliationIssueStatus } : {}),
        ...(filters.severity ? { severity: filters.severity as ReconciliationIssueSeverity } : {}),
        ...(filters.source ? { code: { contains: filters.source, mode: "insensitive" } } : {}),
      },
      include: { run: true },
      orderBy: [{ status: "asc" }, { severity: "asc" }, { createdAt: "asc" }],
    });
    return {
      issues,
      open: issues.filter((issue) => issue.status === "OPEN").length,
      blocking: issues.filter((issue) => issue.status === "OPEN" && issue.severity === "BLOCKING").length,
      warning: issues.filter((issue) => issue.status === "OPEN" && issue.severity === "WARNING").length,
      resolved: issues.filter((issue) => issue.status === "RESOLVED").length,
      ignored: issues.filter((issue) => issue.status === "IGNORED").length,
    };
  }

  async getIssueDetail(workspace: CompanyWorkspace, issueKey: string) {
    await this.refresh(workspace);
    const issue = await prisma.reconciliationIssue.findFirst({
      where: { issueKey, run: { fiscalYearId: workspace.fiscalYear.id } },
      include: { run: true },
    });
    if (!issue) throw new ExpectedRouteError("Point de rapprochement introuvable.", 404);
    return {
      issue,
      entity: await this.entityDetail(issue.entityType, issue.entityId),
      action: recommendedAction(issue.code),
      href: issueHref(issue.code),
      freshness: await this.freshness.getRunFreshness(workspace, issue.run.kind),
    };
  }

  async getIssue(workspace: CompanyWorkspace, issueKey: string) {
    return (await this.getIssueDetail(workspace, issueKey)).issue;
  }

  async resolveIssue(workspace: CompanyWorkspace, input: { issueKey: string; note?: string | null }) {
    const note = requireNote(input.note);
    const { issue } = await this.getIssueDetail(workspace, input.issueKey);
    return prisma.reconciliationIssue.update({
      where: { id: issue.id },
      data: { status: "RESOLVED", note },
    });
  }

  async ignoreIssue(workspace: CompanyWorkspace, input: { issueKey: string; note?: string | null }) {
    const note = requireNote(input.note);
    const { issue } = await this.getIssueDetail(workspace, input.issueKey);
    return prisma.reconciliationIssue.update({
      where: { id: issue.id },
      data: { status: "IGNORED", note },
    });
  }

  async reopenIssue(workspace: CompanyWorkspace, input: { issueKey: string; note?: string | null }) {
    const note = requireNote(input.note);
    const { issue } = await this.getIssueDetail(workspace, input.issueKey);
    return prisma.reconciliationIssue.update({
      where: { id: issue.id },
      data: { status: "OPEN", note },
    });
  }

  async summarizeReviewState(workspace: CompanyWorkspace) {
    const [bank, stripe, thirdParty, suspense, queue, freshness] = await Promise.all([
      this.bank.summarizeBankReconciliation(workspace),
      this.stripe.summarizeStripeReconciliation(workspace),
      this.thirdParty.summarizeThirdPartyMatching(workspace),
      this.suspense.summarizeSuspenseAccounts(workspace),
      this.getReviewQueue(workspace, { status: "OPEN" }),
      this.freshness.getFreshness(workspace),
    ]);
    const stale = freshness.staleCount;
    const status = queue.blocking > 0 ? "blocked" : stale > 0 || queue.warning > 0 ? "ready_with_warnings" : "ready";
    return { status, bank, stripe, thirdParty, suspense, issues: queue, freshness };
  }

  async summarizeReconciliationReadiness(workspace: CompanyWorkspace) {
    return this.summarizeReviewState(workspace);
  }

  private async refresh(workspace: CompanyWorkspace) {
    await Promise.all([
      this.suspense.summarizeSuspenseAccounts(workspace),
    ]);
  }

  private async entityDetail(entityType: string, entityId: string) {
    if (entityType === "transaction") return prisma.transaction.findUnique({ where: { id: entityId } });
    if (entityType === "journalLine") return prisma.journalLine.findUnique({ where: { id: entityId }, include: { journalEntry: true } });
    if (entityType === "stripeEvent") return prisma.stripeEvent.findUnique({ where: { id: entityId } });
    if (entityType === "stripePayout") return prisma.stripePayout.findUnique({ where: { id: entityId } });
    return null;
  }
}

function requireNote(note: string | null | undefined) {
  const trimmed = String(note ?? "").trim();
  if (!trimmed) throw new ExpectedRouteError("Une note est obligatoire pour traiter un point de rapprochement.", 400);
  return trimmed;
}

function recommendedAction(code: string) {
  if (code.startsWith("BANK_UNMATCHED_TRANSACTION")) return "Créer ou corriger l'écriture liée à la transaction bancaire.";
  if (code.startsWith("BANK_UNMATCHED_LEDGER_LINE")) return "Retrouver la transaction bancaire correspondant à la ligne 5121.";
  if (code.startsWith("STRIPE_PAYOUT_UNMATCHED")) return "Importer ou synchroniser les données Stripe puis relancer le rapprochement.";
  if (code.startsWith("STRIPE_FEES")) return "Préparer une OD de frais Stripe en Phase 14.";
  if (code.startsWith("THIRD_PARTY")) return "Lettrer ou documenter le solde tiers ouvert.";
  if (code.startsWith("SUSPENSE_ACCOUNT_OPEN")) return "Corriger la transaction ou préparer une OD validable en Phase 14.";
  return "Documenter le point de rapprochement.";
}

function issueHref(code: string) {
  if (code.startsWith("BANK")) return "/rapprochements/banque";
  if (code.startsWith("STRIPE")) return "/rapprochements/stripe";
  if (code.startsWith("THIRD_PARTY")) return "/rapprochements/tiers";
  if (code.startsWith("SUSPENSE")) return "/rapprochements/attente";
  return "/rapprochements/revue";
}

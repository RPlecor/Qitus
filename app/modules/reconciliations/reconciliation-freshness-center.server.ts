import type { ReconciliationRunKind } from "@prisma/client";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { ExpectedRouteError } from "../route-errors.server";

export type ReconciliationFreshnessStatus = "missing" | "fresh" | "stale";

export type ReconciliationRunFreshness = {
  kind: ReconciliationRunKind;
  status: ReconciliationFreshnessStatus;
  label: string;
  runUpdatedAt: string | null;
  latestDependencyAt: string | null;
  staleReasons: string[];
};

export type ReconciliationFreshness = {
  generatedAt: string;
  runs: Record<ReconciliationRunKind, ReconciliationRunFreshness>;
  staleCount: number;
};

const RECONCILIATION_KINDS: ReconciliationRunKind[] = ["BANK", "STRIPE", "THIRD_PARTY", "SUSPENSE"];

export class ReconciliationFreshnessCenter {
  async getFreshness(workspace: CompanyWorkspace): Promise<ReconciliationFreshness> {
    const entries = await Promise.all(RECONCILIATION_KINDS.map(async (kind) => [kind, await this.getRunFreshness(workspace, kind)] as const));
    const runs = Object.fromEntries(entries) as Record<ReconciliationRunKind, ReconciliationRunFreshness>;
    return {
      generatedAt: new Date().toISOString(),
      runs,
      staleCount: Object.values(runs).filter((run) => run.status === "stale").length,
    };
  }

  async getRunFreshness(workspace: CompanyWorkspace, kind: ReconciliationRunKind): Promise<ReconciliationRunFreshness> {
    const run = await prisma.reconciliationRun.findUnique({
      where: { fiscalYearId_kind: { fiscalYearId: workspace.fiscalYear.id, kind } },
      select: { updatedAt: true, startedAt: true },
    });
    if (!run) {
      return {
        kind,
        status: "missing",
        label: "Jamais lancé",
        runUpdatedAt: null,
        latestDependencyAt: null,
        staleReasons: ["Rapprochement jamais lancé."],
      };
    }

    const staleReasons = await this.getStaleReasons(workspace, kind);
    const latestDependencyAt = await this.latestDependencyAt(workspace, kind);
    return buildReconciliationRunFreshness(kind, run.updatedAt, latestDependencyAt, staleReasons);
  }

  async getStaleReasons(workspace: CompanyWorkspace, kind: ReconciliationRunKind): Promise<string[]> {
    const run = await prisma.reconciliationRun.findUnique({
      where: { fiscalYearId_kind: { fiscalYearId: workspace.fiscalYear.id, kind } },
      select: { updatedAt: true },
    });
    if (!run) return ["Rapprochement jamais lancé."];
    const dependencies = await this.dependencyDates(workspace, kind);
    return dependencies
      .filter((dependency) => dependency.date && dependency.date.getTime() > run.updatedAt.getTime() + 1000)
      .map((dependency) => dependency.label);
  }

  async assertReconciliationFresh(workspace: CompanyWorkspace, kind: ReconciliationRunKind) {
    const freshness = await this.getRunFreshness(workspace, kind);
    if (freshness.status === "missing") {
      throw new ExpectedRouteError("Rapprochement jamais lancé.", 409);
    }
    if (freshness.status === "stale") {
      throw new ExpectedRouteError(`Rapprochement à relancer : ${freshness.staleReasons[0]}.`, 409);
    }
    return freshness;
  }

  private async latestDependencyAt(workspace: CompanyWorkspace, kind: ReconciliationRunKind) {
    const dependencies = await this.dependencyDates(workspace, kind);
    return dependencies.reduce<Date | null>((latest, dependency) => {
      if (!dependency.date) return latest;
      if (!latest || dependency.date > latest) return dependency.date;
      return latest;
    }, null);
  }

  private async dependencyDates(workspace: CompanyWorkspace, kind: ReconciliationRunKind) {
    const base = await Promise.all([
      latestImport(workspace.fiscalYear.id),
      latestTransaction(workspace.fiscalYear.id),
      latestCategorization(workspace.fiscalYear.id),
      latestJournalEntry(workspace.fiscalYear.id),
      latestApprovedClosingAdjustment(workspace.fiscalYear.id),
    ]);
    const dependencies = [
      { label: "Un import a été terminé après le rapprochement.", date: base[0] },
      { label: "Une transaction a été modifiée après le rapprochement.", date: base[1] },
      { label: "Une correction de transaction a été effectuée après le rapprochement.", date: base[2] },
      { label: "Une écriture a été créée ou modifiée après le rapprochement.", date: base[3] },
      { label: "Une OD a été validée après le rapprochement.", date: base[4] },
    ];
    if (kind === "BANK") {
      dependencies.push({ label: "Le solde du relevé bancaire a été modifié après le rapprochement.", date: await latestBankReconciliation(workspace.fiscalYear.id) });
    }
    if (kind === "STRIPE") {
      dependencies.push(
        { label: "Des événements Stripe ont été importés après le rapprochement.", date: await latestStripeEvent(workspace.fiscalYear.id) },
        { label: "Des payouts Stripe ont été importés après le rapprochement.", date: await latestStripePayout(workspace.fiscalYear.id) }
      );
    }
    return dependencies;
  }
}

export function buildReconciliationRunFreshness(
  kind: ReconciliationRunKind,
  runUpdatedAt: Date,
  latestDependencyAt: Date | null,
  staleReasons: string[]
): ReconciliationRunFreshness {
  return {
    kind,
    status: staleReasons.length > 0 ? "stale" : "fresh",
    label: staleReasons.length > 0 ? "À relancer" : "À jour",
    runUpdatedAt: runUpdatedAt.toISOString(),
    latestDependencyAt: latestDependencyAt?.toISOString() ?? null,
    staleReasons,
  };
}

async function latestImport(fiscalYearId: string) {
  const item = await prisma.import.findFirst({ where: { fiscalYearId, status: { in: ["DONE", "REVIEW"] } }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true, completedAt: true } });
  return item?.completedAt ?? item?.updatedAt ?? null;
}

async function latestTransaction(fiscalYearId: string) {
  return (await prisma.transaction.findFirst({ where: { fiscalYearId }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }))?.updatedAt ?? null;
}

async function latestCategorization(fiscalYearId: string) {
  return (await prisma.categorization.findFirst({ where: { fiscalYearId }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }))?.updatedAt ?? null;
}

async function latestJournalEntry(fiscalYearId: string) {
  return (await prisma.journalEntry.findFirst({ where: { fiscalYearId }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }))?.updatedAt ?? null;
}

async function latestApprovedClosingAdjustment(fiscalYearId: string) {
  return (await prisma.closingAdjustmentProposal.findFirst({ where: { fiscalYearId, status: "APPROVED" }, orderBy: { approvedAt: "desc" }, select: { approvedAt: true, updatedAt: true } }))?.approvedAt ?? null;
}

async function latestBankReconciliation(fiscalYearId: string) {
  return (await prisma.bankReconciliation.findFirst({ where: { fiscalYearId }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }))?.updatedAt ?? null;
}

async function latestStripeEvent(fiscalYearId: string) {
  return (await prisma.stripeEvent.findFirst({ where: { fiscalYearId }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }))?.updatedAt ?? null;
}

async function latestStripePayout(fiscalYearId: string) {
  return (await prisma.stripePayout.findFirst({ where: { fiscalYearId }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }))?.updatedAt ?? null;
}

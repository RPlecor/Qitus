import type { ClosingAdjustmentStatus } from "@prisma/client";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { ExpectedRouteError } from "../route-errors.server";
import type { ClosingAdjustmentSummary } from "./closing-adjustment-center.server";
import { workpaperKeyFromClosingProposalKey } from "./closing-adjustment-evidence.server";

export type ClosingAdjustmentFreshnessStatus = "fresh" | "stale" | "final";

export type ClosingAdjustmentFreshness = {
  proposalKey: string;
  status: ClosingAdjustmentFreshnessStatus;
  statusLabel: string;
  stale: boolean;
  reasons: Array<{
    code: string;
    label: string;
    happenedAt: string;
  }>;
};

export type ClosingAdjustmentFreshnessOverview = {
  total: number;
  staleCount: number;
  freshCount: number;
  finalCount: number;
  proposals: ClosingAdjustmentFreshness[];
};

const STALE_ACTIVITY_LABELS: Record<string, string> = {
  "import.completed": "Import terminé après le calcul",
  "transaction.categorized": "Transaction corrigée après le calcul",
  "transaction.corrected": "Transaction corrigée après le calcul",
  "journal_entry.created": "Écriture créée après le calcul",
  "closing_adjustment.approved": "OD validée après le calcul",
  "vat.issue_resolved": "TVA modifiée après le calcul",
  "vat.declaration_generated": "Déclaration TVA générée après le calcul",
  "reconciliation.issue_resolved": "Rapprochement modifié après le calcul",
  "reconciliation.issue_ignored": "Rapprochement modifié après le calcul",
  "attachment.linked": "Pièce rattachée après le calcul",
  "attachment.unlinked": "Pièce détachée après le calcul",
  "profile.updated": "Profil fiscal modifié après le calcul",
};

export class ClosingAdjustmentFreshnessCenter {
  async getFreshness(workspace: CompanyWorkspace): Promise<ClosingAdjustmentFreshnessOverview> {
    const proposals = await prisma.closingAdjustmentProposal.findMany({
      where: { fiscalYearId: workspace.fiscalYear.id },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    });
    const details = await Promise.all(proposals.map((proposal) => this.freshnessForRow(workspace, {
      proposalKey: proposal.proposalKey,
      status: proposal.status,
      staleReason: proposal.staleReason,
      lastCalculatedAt: proposal.lastCalculatedAt?.toISOString() ?? null,
    })));
    return {
      total: details.length,
      staleCount: details.filter((item) => item.stale).length,
      freshCount: details.filter((item) => item.status === "fresh").length,
      finalCount: details.filter((item) => item.status === "final").length,
      proposals: details,
    };
  }

  async getProposalFreshness(workspace: CompanyWorkspace, proposalKey: string): Promise<ClosingAdjustmentFreshness> {
    const proposal = await prisma.closingAdjustmentProposal.findUnique({
      where: { fiscalYearId_proposalKey: { fiscalYearId: workspace.fiscalYear.id, proposalKey } },
    });
    if (!proposal) throw new ExpectedRouteError("Proposition OD introuvable.", 404);
    return this.freshnessForRow(workspace, {
      proposalKey: proposal.proposalKey,
      status: proposal.status,
      staleReason: proposal.staleReason,
      lastCalculatedAt: proposal.lastCalculatedAt?.toISOString() ?? null,
    });
  }

  async getStaleReasons(workspace: CompanyWorkspace) {
    return (await this.getFreshness(workspace)).proposals.filter((proposal) => proposal.stale);
  }

  async assertProposalFresh(workspace: CompanyWorkspace, proposalKey: string) {
    const freshness = await this.getProposalFreshness(workspace, proposalKey);
    if (freshness.stale) {
      throw new ExpectedRouteError(`Recalcule l'OD avant validation : ${freshness.reasons[0]?.label ?? "elle est obsolète"}.`, 409);
    }
    return freshness;
  }

  private async freshnessForRow(
    workspace: CompanyWorkspace,
    proposal: Pick<ClosingAdjustmentSummary, "proposalKey" | "status" | "staleReason" | "lastCalculatedAt">
  ): Promise<ClosingAdjustmentFreshness> {
    if (proposal.status !== "DRAFT") {
      return {
        proposalKey: proposal.proposalKey,
        status: "final",
        statusLabel: proposal.status === "APPROVED" ? "Validée" : "Rejetée",
        stale: false,
        reasons: [],
      };
    }
    const calculatedAt = proposal.lastCalculatedAt ? new Date(proposal.lastCalculatedAt) : null;
    const reasons: ClosingAdjustmentFreshness["reasons"] = [];
    if (proposal.staleReason) {
      reasons.push({ code: "proposal_stale_reason", label: proposal.staleReason, happenedAt: new Date().toISOString() });
    }
    if (!calculatedAt) {
      reasons.push({ code: "never_calculated", label: "OD jamais calculée.", happenedAt: new Date().toISOString() });
    } else {
      reasons.push(...await this.workpaperReasons(workspace, proposal.proposalKey, calculatedAt));
      reasons.push(...await this.activityReasons(workspace, calculatedAt));
    }
    const stale = reasons.length > 0;
    return {
      proposalKey: proposal.proposalKey,
      status: stale ? "stale" : "fresh",
      statusLabel: stale ? "À recalculer" : "À jour",
      stale,
      reasons,
    };
  }

  private async workpaperReasons(workspace: CompanyWorkspace, proposalKey: string, calculatedAt: Date) {
    const workpaperKey = workpaperKeyFromClosingProposalKey(proposalKey);
    if (!workpaperKey) return [];
    const workpaper = await prisma.closingWorkpaper.findUnique({
      where: { fiscalYearId_workpaperKey: { fiscalYearId: workspace.fiscalYear.id, workpaperKey } },
      select: { updatedAt: true, title: true },
    });
    if (!workpaper || workpaper.updatedAt <= calculatedAt) return [];
    return [{
      code: "workpaper_updated",
      label: `Workpaper modifié après le calcul : ${workpaper.title}.`,
      happenedAt: workpaper.updatedAt.toISOString(),
    }];
  }

  private async activityReasons(workspace: CompanyWorkspace, calculatedAt: Date) {
    const rows = await prisma.activityLog.findMany({
      where: {
        companyId: workspace.company.id,
        fiscalYearId: workspace.fiscalYear.id,
        createdAt: { gt: calculatedAt },
        action: { in: Object.keys(STALE_ACTIVITY_LABELS) },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    return rows.map((row) => ({
      code: row.action,
      label: STALE_ACTIVITY_LABELS[row.action] ?? row.action,
      happenedAt: row.createdAt.toISOString(),
    }));
  }
}

export function closingAdjustmentStatusLabel(status: ClosingAdjustmentStatus, stale: boolean) {
  if (status === "APPROVED") return "Validée";
  if (status === "REJECTED") return "Rejetée";
  return stale ? "À recalculer" : "À jour";
}

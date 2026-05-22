import type { BankConnection } from "@prisma/client";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";

const STALE_ACTIONS = [
  "import.completed",
  "transaction.categorized",
  "reconciliation.bank_run",
  "reconciliation.bank_match_confirmed",
  "reconciliation.bank_match_ignored",
  "bank_reconciliation.saved",
  "bank_reconciliation.confirmed",
];

export class OpenBankingFreshnessCenter {
  async getFreshness(workspace: CompanyWorkspace) {
    const connections = await prisma.bankConnection.findMany({
      where: { companyId: workspace.company.id },
      orderBy: { createdAt: "desc" },
    });
    const details = await Promise.all(connections.map((connection) => this.getConnectionFreshness(workspace, connection)));
    return {
      status: details.some((detail) => detail.status === "expired" || detail.status === "stale")
        ? "warning" as const
        : details.length === 0
          ? "never_connected" as const
          : "fresh" as const,
      connections: details,
    };
  }

  async getConnectionFreshness(workspace: CompanyWorkspace, connection: BankConnection) {
    const now = new Date();
    if (connection.status === "REVOKED") {
      return { connectionId: connection.id, status: "revoked" as const, staleReasons: ["Connexion révoquée."] };
    }
    if (connection.consentExpiresAt && connection.consentExpiresAt <= now) {
      return { connectionId: connection.id, status: "expired" as const, staleReasons: ["Consentement bancaire expiré."] };
    }
    if (!connection.lastSyncedAt) {
      return { connectionId: connection.id, status: "never_synced" as const, staleReasons: ["Connexion jamais synchronisée."] };
    }
    const staleReasons = await this.getStaleReasons(workspace, connection.lastSyncedAt);
    return {
      connectionId: connection.id,
      status: staleReasons.length > 0 ? "stale" as const : "fresh" as const,
      lastSyncedAt: connection.lastSyncedAt.toISOString(),
      staleReasons,
    };
  }

  async getStaleReasons(workspace: CompanyWorkspace, since?: Date | null) {
    if (!since) return ["Synchronisation jamais lancée."];
    const events = await prisma.activityLog.findMany({
      where: {
        companyId: workspace.company.id,
        fiscalYearId: workspace.fiscalYear.id,
        action: { in: STALE_ACTIONS },
        createdAt: { gt: since },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    return events.map((event) => staleReasonLabel(event.action, event.createdAt));
  }
}

function staleReasonLabel(action: string, date: Date) {
  const at = date.toISOString();
  if (action === "import.completed") return `Import terminé après la dernière sync (${at}).`;
  if (action === "transaction.categorized") return `Transaction corrigée après la dernière sync (${at}).`;
  if (action.startsWith("reconciliation.") || action.startsWith("bank_reconciliation.")) return `Rapprochement bancaire modifié après la dernière sync (${at}).`;
  return `${action} après la dernière sync (${at}).`;
}

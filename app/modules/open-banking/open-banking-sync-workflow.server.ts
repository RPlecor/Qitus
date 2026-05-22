import type { Prisma } from "@prisma/client";
import { assertFiscalYearMutable } from "../annual-closing/annual-closing-center.server";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { ExpectedRouteError } from "../route-errors.server";
import { getRuntimeConfig, type RuntimeConfig } from "../runtime-config.server";
import { OpenBankingCenter } from "./open-banking-center.server";
import { OpenBankingFreshnessCenter } from "./open-banking-freshness-center.server";

export class OpenBankingSyncWorkflow {
  constructor(private readonly config: RuntimeConfig = getRuntimeConfig()) {}

  async getSyncHistory(workspace: CompanyWorkspace, limit = 25) {
    const events = await prisma.bankFeedSyncEvent.findMany({
      where: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id },
      orderBy: { startedAt: "desc" },
      take: Math.min(Math.max(limit, 1), 100),
    });
    return events.map((event) => ({
      id: event.id,
      bankConnectionId: event.bankConnectionId,
      status: event.status,
      startedAt: event.startedAt.toISOString(),
      finishedAt: event.finishedAt?.toISOString() ?? null,
      transactionsFetched: event.transactionsFetched,
      transactionsImported: event.transactionsImported,
      errorCode: event.errorCode,
      errorMessage: event.errorMessage,
      metadata: event.metadataJson,
    }));
  }

  async getConnectionDetail(workspace: CompanyWorkspace, connectionId: string) {
    const connection = await prisma.bankConnection.findFirst({
      where: { id: connectionId, companyId: workspace.company.id },
      include: { accounts: true, syncEvents: { orderBy: { startedAt: "desc" }, take: 10 } },
    });
    if (!connection) throw new ExpectedRouteError("Connexion Open Banking introuvable.", 404);
    const freshness = await new OpenBankingFreshnessCenter().getConnectionFreshness(workspace, connection);
    const latestWebhook = await prisma.webhookEvent.findFirst({
      where: { provider: "open_banking" },
      orderBy: { receivedAt: "desc" },
    });
    return {
      id: connection.id,
      provider: connection.provider,
      status: connection.status,
      effectiveStatus: effectiveConnectionStatus(connection),
      consentExpiresAt: connection.consentExpiresAt?.toISOString() ?? null,
      lastSyncedAt: connection.lastSyncedAt?.toISOString() ?? null,
      accounts: connection.accounts.map((account) => ({
        id: account.id,
        name: account.name,
        ibanMasked: account.ibanMasked,
        currency: account.currency,
        status: account.status,
      })),
      syncEvents: connection.syncEvents.map((event) => ({
        id: event.id,
        status: event.status,
        startedAt: event.startedAt.toISOString(),
        finishedAt: event.finishedAt?.toISOString() ?? null,
        transactionsFetched: event.transactionsFetched,
        transactionsImported: event.transactionsImported,
        errorMessage: event.errorMessage,
      })),
      freshness,
      latestWebhook: latestWebhook ? {
        eventId: latestWebhook.eventId,
        eventType: latestWebhook.eventType,
        status: latestWebhook.status,
        receivedAt: latestWebhook.receivedAt.toISOString(),
        processedAt: latestWebhook.processedAt?.toISOString() ?? null,
        errorMessage: latestWebhook.errorMessage,
      } : null,
    };
  }

  async syncConnection(workspace: CompanyWorkspace, input: { connectionId?: string | null }) {
    await assertFiscalYearMutable(workspace);
    return new OpenBankingCenter(this.config).sync(workspace, input.connectionId ?? undefined);
  }

  async reconnect(workspace: CompanyWorkspace, connectionId: string) {
    await assertFiscalYearMutable(workspace);
    const connection = await prisma.bankConnection.findFirst({ where: { id: connectionId, companyId: workspace.company.id } });
    if (!connection) throw new ExpectedRouteError("Connexion Open Banking introuvable.", 404);
    if (this.config.openBankingProvider !== "mock") {
      throw new ExpectedRouteError("Reconnecter un provider live nécessite l'Adapter HTTP concret. Utilise le mock en validation locale.", 501);
    }
    const updated = await prisma.bankConnection.update({
      where: { id: connection.id },
      data: {
        status: "ACTIVE",
        consentExpiresAt: new Date(Date.now() + 90 * 86_400_000),
        metadataJson: { reconnectedAt: new Date().toISOString(), source: "mock" } as Prisma.InputJsonObject,
      },
    });
    return updated;
  }
}

function effectiveConnectionStatus(connection: { status: string; consentExpiresAt: Date | null }) {
  if (connection.status === "ACTIVE" && connection.consentExpiresAt && connection.consentExpiresAt <= new Date()) return "EXPIRED";
  return connection.status;
}

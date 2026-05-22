import { ActivityLogCenter } from "../activity-log/activity-log-center.server";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { createEInvoiceProviderAdapter, type EInvoiceProviderAdapter } from "./e-invoice-provider-adapter.server";

export class EInvoiceProviderCenter {
  constructor(
    private readonly adapter: EInvoiceProviderAdapter = createEInvoiceProviderAdapter(),
    private readonly activity = new ActivityLogCenter()
  ) {}

  async getStatus(workspace: CompanyWorkspace) {
    const [provider, connections, syncEvents] = await Promise.all([
      this.adapter.getStatus(),
      prisma.eInvoiceProviderConnection.findMany({ where: { companyId: workspace.company.id }, orderBy: { updatedAt: "desc" }, take: 10 }),
      prisma.eInvoiceProviderSyncEvent.findMany({ where: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id }, orderBy: { startedAt: "desc" }, take: 10 }),
    ]);
    return {
      ...provider,
      connections: connections.map((connection) => ({
        id: connection.id,
        provider: connection.provider,
        status: connection.status,
        safeLabel: connection.safeLabel,
        lastSyncedAt: connection.lastSyncedAt?.toISOString() ?? null,
        errorMessage: connection.errorMessage,
      })),
      syncEvents: syncEvents.map((event) => ({
        id: event.id,
        provider: event.provider,
        status: event.status,
        fetchedCount: event.fetchedCount,
        importedCount: event.importedCount,
        errorMessage: event.errorMessage,
        startedAt: event.startedAt.toISOString(),
        finishedAt: event.finishedAt?.toISOString() ?? null,
      })),
    };
  }

  async createConnection(workspace: CompanyWorkspace) {
    const status = await this.adapter.getStatus();
    const consent = await this.adapter.createConnection();
    const connection = await prisma.eInvoiceProviderConnection.upsert({
      where: {
        companyId_provider_providerConnectionId: {
          companyId: workspace.company.id,
          provider: status.provider,
          providerConnectionId: consent.providerConnectionId,
        },
      },
      create: {
        companyId: workspace.company.id,
        provider: status.provider,
        providerConnectionId: consent.providerConnectionId,
        status: "ACTIVE",
        safeLabel: consent.safeLabel,
      },
      update: { status: "ACTIVE", safeLabel: consent.safeLabel, errorMessage: null },
    });
    await this.activity.recordActivity(workspace, {
      action: "e_invoice_provider.connected",
      entityType: "e_invoice_provider",
      entityId: connection.id,
      metadata: { provider: connection.provider },
    });
    return { connectionId: connection.id, redirectUrl: consent.redirectUrl, status: connection.status };
  }
}

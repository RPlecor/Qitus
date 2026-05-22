import { ActivityLogCenter } from "../activity-log/activity-log-center.server";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { ExpectedRouteError } from "../route-errors.server";
import { createEInvoiceProviderAdapter, type EInvoiceProviderAdapter, type EInvoiceProviderLifecycleStatus } from "./e-invoice-provider-adapter.server";
import { EInvoiceProviderConnectionCenter } from "./e-invoice-provider-connection-center.server";
import { EInvoiceLifecycleCenter } from "./e-invoice-lifecycle-center.server";

export class EInvoiceProviderCenter {
  constructor(
    private readonly adapter: EInvoiceProviderAdapter = createEInvoiceProviderAdapter(),
    private readonly activity = new ActivityLogCenter(),
    private readonly connections = new EInvoiceProviderConnectionCenter(adapter, activity),
    private readonly lifecycle = new EInvoiceLifecycleCenter()
  ) {}

  async getStatus(workspace: CompanyWorkspace) {
    const [provider, connections, syncEvents] = await Promise.all([
      this.adapter.getStatus(),
      prisma.eInvoiceProviderConnection.findMany({ where: { companyId: workspace.company.id }, orderBy: { updatedAt: "desc" }, take: 10 }),
      prisma.eInvoiceProviderSyncEvent.findMany({ where: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id }, orderBy: { startedAt: "desc" }, take: 10 }),
    ]);
    return {
      ...provider,
      readiness: await this.connections.getReadiness(workspace),
      connections: connections.map((connection) => ({
        id: connection.id,
        provider: connection.provider,
        providerCompanyId: connection.providerCompanyId,
        status: connection.status,
        mandateStatus: connection.mandateStatus,
        connectionStatus: connection.connectionStatus,
        safeLabel: connection.safeLabel,
        lastSyncedAt: connection.lastSyncedAt?.toISOString() ?? null,
        lastStatusSyncedAt: connection.lastStatusSyncedAt?.toISOString() ?? null,
        errorMessage: connection.errorMessage,
        capabilities: Array.isArray(connection.capabilitiesJson) ? connection.capabilitiesJson : [],
        safeMetadata: connection.safeMetadataJson,
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
    return this.connections.createConnection(workspace);
  }

  async disconnect(workspace: CompanyWorkspace, connectionId?: string | null) {
    return this.connections.disconnect(workspace, connectionId);
  }

  async acknowledgeInvoiceStatus(workspace: CompanyWorkspace, eInvoiceId: string, status: EInvoiceProviderLifecycleStatus) {
    const invoice = await prisma.eInvoice.findFirst({
      where: { id: eInvoiceId, companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id },
    });
    if (!invoice) throw new ExpectedRouteError("Facture électronique introuvable.", 404);
    if (invoice.source !== "PROVIDER" || !invoice.sourceId) {
      throw new ExpectedRouteError("Seules les factures reçues via PA peuvent être acquittées auprès du provider.", 409);
    }
    await this.adapter.acknowledgeInvoiceStatus?.(invoice.sourceId, status);
    const updated = await prisma.eInvoice.update({
      where: { id: invoice.id },
      data: {
        providerStatus: status,
        status: this.lifecycle.toQitusStatus(status, invoice.status),
        providerStatusSyncedAt: new Date(),
      },
    });
    await this.activity.recordActivity(workspace, {
      action: "e_invoice_provider.status_acknowledged",
      entityType: "e_invoice",
      entityId: invoice.id,
      metadata: { providerStatus: status },
    });
    return { id: updated.id, providerStatus: updated.providerStatus, status: updated.status };
  }
}

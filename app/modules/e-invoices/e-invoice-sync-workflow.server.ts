import { assertFiscalYearMutable } from "../annual-closing/annual-closing-center.server";
import { ActivityLogCenter } from "../activity-log/activity-log-center.server";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { createEInvoiceProviderAdapter, type EInvoiceProviderAdapter } from "./e-invoice-provider-adapter.server";
import { EInvoiceCenter } from "./e-invoice-center.server";

export class EInvoiceSyncWorkflow {
  constructor(
    private readonly adapter: EInvoiceProviderAdapter = createEInvoiceProviderAdapter(),
    private readonly invoices = new EInvoiceCenter(),
    private readonly activity = new ActivityLogCenter()
  ) {}

  async syncIncomingInvoices(workspace: CompanyWorkspace) {
    await assertFiscalYearMutable(workspace);
    const provider = await this.adapter.getStatus();
    const event = await prisma.eInvoiceProviderSyncEvent.create({
      data: {
        companyId: workspace.company.id,
        fiscalYearId: workspace.fiscalYear.id,
        provider: provider.provider,
        status: "STARTED",
      },
    });
    try {
      const connection = await prisma.eInvoiceProviderConnection.findFirst({
        where: { companyId: workspace.company.id, provider: provider.provider, status: "ACTIVE" },
        orderBy: { updatedAt: "desc" },
      });
      const payloads = await this.adapter.listIncomingInvoices({ providerConnectionId: connection?.providerConnectionId ?? null });
      let importedCount = 0;
      for (const payload of payloads) {
        const invoice = await this.invoices.ingestProviderInvoice(workspace, {
          ...payload,
          providerConnectionId: connection?.id ?? null,
        });
        if (invoice) importedCount += 1;
      }
      const updated = await prisma.eInvoiceProviderSyncEvent.update({
        where: { id: event.id },
        data: {
          status: "COMPLETED",
          finishedAt: new Date(),
          fetchedCount: payloads.length,
          importedCount,
        },
      });
      await prisma.eInvoiceProviderConnection.updateMany({
        where: { companyId: workspace.company.id, provider: provider.provider },
        data: {
          lastSyncedAt: new Date(),
          lastStatusSyncedAt: new Date(),
          errorMessage: null,
          safeMetadataJson: {
            lastSync: {
              fetchedCount: payloads.length,
              importedCount,
              finishedAt: new Date().toISOString(),
            },
          },
        },
      });
      await this.activity.recordActivity(workspace, {
        action: "e_invoice_provider.synced",
        entityType: "e_invoice_provider",
        metadata: { provider: provider.provider, fetchedCount: payloads.length, importedCount },
      });
      return summarizeSyncEvent(updated);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Synchronisation facture électronique échouée.";
      const updated = await prisma.eInvoiceProviderSyncEvent.update({
        where: { id: event.id },
        data: { status: "FAILED", finishedAt: new Date(), errorMessage: message },
      });
      await prisma.eInvoiceProviderConnection.updateMany({
        where: { companyId: workspace.company.id, provider: provider.provider },
        data: { errorMessage: message },
      });
      return summarizeSyncEvent(updated);
    }
  }
}

function summarizeSyncEvent(event: {
  id: string;
  provider: string;
  status: string;
  fetchedCount: number;
  importedCount: number;
  errorMessage: string | null;
  startedAt: Date;
  finishedAt: Date | null;
}) {
  return {
    id: event.id,
    provider: event.provider,
    status: event.status,
    fetchedCount: event.fetchedCount,
    importedCount: event.importedCount,
    errorMessage: event.errorMessage,
    startedAt: event.startedAt.toISOString(),
    finishedAt: event.finishedAt?.toISOString() ?? null,
  };
}

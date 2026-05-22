import { prisma } from "../db.server";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";

export class EInvoiceAuditTrailCenter {
  async getProviderAudit(workspace: CompanyWorkspace, limit = 30) {
    const [events, syncs, connections] = await Promise.all([
      prisma.webhookEvent.findMany({
        where: { provider: "e_invoice_provider" },
        orderBy: { receivedAt: "desc" },
        take: limit,
      }),
      prisma.eInvoiceProviderSyncEvent.findMany({
        where: { companyId: workspace.company.id },
        orderBy: { startedAt: "desc" },
        take: limit,
      }),
      prisma.eInvoiceProviderConnection.findMany({
        where: { companyId: workspace.company.id },
        orderBy: { updatedAt: "desc" },
        take: 10,
      }),
    ]);
    return {
      events: events.map((event) => ({
        id: event.id,
        eventId: event.eventId,
        eventType: event.eventType,
        status: event.status,
        receivedAt: event.receivedAt.toISOString(),
        processedAt: event.processedAt?.toISOString() ?? null,
        errorMessage: event.errorMessage,
      })),
      syncs: syncs.map((sync) => ({
        id: sync.id,
        provider: sync.provider,
        status: sync.status,
        fetchedCount: sync.fetchedCount,
        importedCount: sync.importedCount,
        errorMessage: sync.errorMessage,
        startedAt: sync.startedAt.toISOString(),
        finishedAt: sync.finishedAt?.toISOString() ?? null,
      })),
      connections: connections.map((connection) => ({
        id: connection.id,
        provider: connection.provider,
        status: connection.status,
        mandateStatus: connection.mandateStatus,
        safeLabel: connection.safeLabel,
        lastSyncedAt: connection.lastSyncedAt?.toISOString() ?? null,
        lastStatusSyncedAt: connection.lastStatusSyncedAt?.toISOString() ?? null,
      })),
    };
  }

  async getInvoiceAudit(workspace: CompanyWorkspace, eInvoiceId: string) {
    const invoice = await prisma.eInvoice.findFirst({
      where: { id: eInvoiceId, companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id },
      include: { accountingDrafts: { orderBy: { createdAt: "desc" }, take: 5 } },
    });
    if (!invoice) return [];
    return [
      {
        label: "Réception",
        value: invoice.providerReceivedAt?.toISOString() ?? invoice.createdAt.toISOString(),
        detail: invoice.source === "PROVIDER" ? "Réception via provider PA" : "Upload manuel dans Qitus",
      },
      {
        label: "Statut PA",
        value: invoice.providerStatus ?? "—",
        detail: invoice.providerStatusSyncedAt ? `Synchronisé le ${invoice.providerStatusSyncedAt.toISOString()}` : "Aucune synchronisation de statut PA",
      },
      {
        label: "XML source",
        value: invoice.rawXmlStorageKey ? "Conservé" : "Absent",
        detail: invoice.rawXmlStorageKey ?? "Aucune clé de stockage XML",
      },
      ...invoice.accountingDrafts.map((draft) => ({
        label: "Brouillon comptable",
        value: draft.status,
        detail: draft.journalEntryId ? `Écriture ${draft.journalEntryId}` : draft.note ?? "Pas d'écriture créée",
      })),
    ];
  }
}

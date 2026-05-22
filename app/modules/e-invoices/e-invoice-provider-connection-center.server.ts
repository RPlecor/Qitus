import { Prisma } from "@prisma/client";
import { ActivityLogCenter } from "../activity-log/activity-log-center.server";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { ExpectedRouteError } from "../route-errors.server";
import { createEInvoiceProviderAdapter, type EInvoiceProviderAdapter, type EInvoiceProviderConnectionResult } from "./e-invoice-provider-adapter.server";

export class EInvoiceProviderConnectionCenter {
  constructor(
    private readonly adapter: EInvoiceProviderAdapter = createEInvoiceProviderAdapter(),
    private readonly activity = new ActivityLogCenter()
  ) {}

  async createConnection(workspace: CompanyWorkspace) {
    const provider = await this.adapter.getStatus();
    const consent = await this.adapter.createConnection({ companyId: workspace.company.id });
    const connection = await this.upsertConnection(workspace, provider.provider, consent);
    await this.activity.recordActivity(workspace, {
      action: "e_invoice_provider.connected",
      entityType: "e_invoice_provider",
      entityId: connection.id,
      metadata: { provider: connection.provider, status: connection.status, mandateStatus: connection.mandateStatus },
    });
    return { connectionId: connection.id, redirectUrl: consent.redirectUrl, status: connection.status, mandateStatus: connection.mandateStatus };
  }

  async disconnect(workspace: CompanyWorkspace, connectionId?: string | null) {
    const connection = await prisma.eInvoiceProviderConnection.findFirst({
      where: { id: connectionId ?? undefined, companyId: workspace.company.id },
      orderBy: { updatedAt: "desc" },
    });
    if (!connection) throw new ExpectedRouteError("Aucune connexion PA à révoquer.", 404);
    if (connection.providerConnectionId) await this.adapter.disconnect(connection.providerConnectionId);
    const updated = await prisma.eInvoiceProviderConnection.update({
      where: { id: connection.id },
      data: { status: "REVOKED", mandateStatus: "REVOKED", revokedAt: new Date(), lastStatusSyncedAt: new Date() },
    });
    await this.activity.recordActivity(workspace, {
      action: "e_invoice_provider.disconnected",
      entityType: "e_invoice_provider",
      entityId: updated.id,
      metadata: { provider: updated.provider },
    });
    return updated;
  }

  async getReadiness(workspace: CompanyWorkspace) {
    const provider = await this.adapter.getStatus();
    const connections = await prisma.eInvoiceProviderConnection.findMany({
      where: { companyId: workspace.company.id },
      orderBy: { updatedAt: "desc" },
      take: 10,
    });
    const active = connections.find((connection) => connection.status === "ACTIVE" && connection.mandateStatus === "ACTIVE");
    const hasError = connections.some((connection) => connection.status === "ERROR" || connection.mandateStatus === "ERROR" || connection.errorMessage);
    const status = provider.mode === "disabled" ? "disabled" : active && provider.receptionCompliant ? "compliant" : active ? "sandbox_or_adapter" : hasError ? "error" : provider.configured ? "configured" : "missing_config";
    return {
      status,
      provider,
      receptionCompliant: Boolean(active && provider.receptionCompliant),
      activeConnectionId: active?.id ?? null,
      message: readinessMessage(status),
      recommendedAction: status === "missing_config" ? "Configurer les variables E_INVOICE_PROVIDER_*." : status === "configured" ? "Brancher une PA concrète ou utiliser le mock pour tester." : null,
    };
  }

  private async upsertConnection(workspace: CompanyWorkspace, provider: string, input: EInvoiceProviderConnectionResult) {
    return prisma.eInvoiceProviderConnection.upsert({
      where: {
        companyId_provider_providerConnectionId: {
          companyId: workspace.company.id,
          provider,
          providerConnectionId: input.providerConnectionId,
        },
      },
      create: {
        companyId: workspace.company.id,
        provider,
        providerConnectionId: input.providerConnectionId,
        providerCompanyId: input.providerCompanyId,
        status: input.status,
        mandateStatus: input.mandateStatus,
        connectionStatus: input.status,
        safeLabel: input.safeLabel,
        capabilitiesJson: (input.capabilities ?? []) as Prisma.InputJsonArray,
        safeMetadataJson: (input.safeMetadata ?? {}) as Prisma.InputJsonObject,
        lastStatusSyncedAt: new Date(),
      },
      update: {
        providerCompanyId: input.providerCompanyId,
        status: input.status,
        mandateStatus: input.mandateStatus,
        connectionStatus: input.status,
        safeLabel: input.safeLabel,
        capabilitiesJson: (input.capabilities ?? []) as Prisma.InputJsonArray,
        safeMetadataJson: (input.safeMetadata ?? {}) as Prisma.InputJsonObject,
        errorMessage: null,
        revokedAt: null,
        lastStatusSyncedAt: new Date(),
      },
    });
  }
}

function readinessMessage(status: string) {
  if (status === "compliant") return "Réception PA conforme active.";
  if (status === "sandbox_or_adapter") return "Connexion active, mais pas marquée conforme PA réelle.";
  if (status === "configured") return "Configuration PA présente, connexion à finaliser.";
  if (status === "missing_config") return "Réception PA non configurée.";
  if (status === "error") return "Connexion PA en erreur.";
  return "Réception PA désactivée.";
}

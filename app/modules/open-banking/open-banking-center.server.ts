import { Prisma } from "@prisma/client";
import { ActivityLogCenter } from "../activity-log/activity-log-center.server";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { ImportOrchestrator } from "../import-orchestrator/import-orchestrator.server";
import { MetricsCenter } from "../monitoring/monitoring-center.server";
import { ReconciliationFreshnessCenter } from "../reconciliations/reconciliation-freshness-center.server";
import { ExpectedRouteError } from "../route-errors.server";
import { getRuntimeConfig, type RuntimeConfig } from "../runtime-config.server";
import { BankFeedNormalizer } from "./bank-feed-normalizer.server";
import { createOpenBankingProviderAdapter, type OpenBankingProviderAdapter } from "./open-banking-provider-adapter.server";

export class OpenBankingCenter {
  private readonly normalizer = new BankFeedNormalizer();

  constructor(
    private readonly config: RuntimeConfig = getRuntimeConfig(),
    private readonly provider: OpenBankingProviderAdapter | null = null,
    private readonly activity = new ActivityLogCenter(),
    private readonly metrics = new MetricsCenter()
  ) {}

  async getStatus(workspace: CompanyWorkspace) {
    const providerInfo = this.providerInfo();
    const connections = await prisma.bankConnection.findMany({
      where: { companyId: workspace.company.id },
      include: { accounts: true },
      orderBy: { createdAt: "desc" },
    });
    const syncEvents = await prisma.bankFeedSyncEvent.findMany({
      where: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id },
      orderBy: { startedAt: "desc" },
      take: 10,
    });
    return {
      provider: this.config.openBankingProvider,
      providerLabel: providerInfo.providerLabel,
      selectionMode: providerInfo.selectionMode,
      enabled: this.config.openBankingProvider !== "disabled",
      configured: this.isConfigured(),
      message: this.statusMessage(),
      safeMessage: this.statusMessage(),
      supportsInstitutions: providerInfo.selectionMode === "institution_select",
      connections: connections.map((connection) => ({
        id: connection.id,
        provider: connection.provider,
        status: effectiveConnectionStatus(connection.status, connection.consentExpiresAt),
        consentExpiresAt: connection.consentExpiresAt?.toISOString() ?? null,
        lastSyncedAt: connection.lastSyncedAt?.toISOString() ?? null,
        accounts: connection.accounts.map((account) => ({
          id: account.id,
          name: account.name,
          ibanMasked: account.ibanMasked,
          currency: account.currency,
          status: account.status,
        })),
      })),
      latestSyncs: syncEvents.map((event) => ({
        id: event.id,
        status: event.status,
        startedAt: event.startedAt.toISOString(),
        finishedAt: event.finishedAt?.toISOString() ?? null,
        transactionsFetched: event.transactionsFetched,
        transactionsImported: event.transactionsImported,
        errorMessage: event.errorMessage,
      })),
    };
  }

  async listInstitutions(input: { country?: string } = {}) {
    const adapter = this.adapter();
    if (!adapter.listInstitutions) return [];
    return adapter.listInstitutions({ country: input.country ?? "FR" });
  }

  async createConsent(workspace: CompanyWorkspace, input: { redirectUri?: string; institutionId?: string | null; country?: string | null } = {}) {
    const adapter = this.adapter();
    const state = `${workspace.company.id}:${workspace.fiscalYear.id}:${Date.now()}`;
    const redirectUri = input.redirectUri ?? this.defaultRedirectUri();
    const consent = await adapter.createConsent({ state, redirectUri, institutionId: input.institutionId, country: input.country });
    if (consent.providerConnectionId) {
      await this.upsertConnection(workspace, consent.providerConnectionId, consent.consentExpiresAt ?? addDays(90).toISOString(), "PENDING", {
        state,
        institutionId: input.institutionId ?? null,
        provider: this.config.openBankingProvider,
        ...(consent.metadata ?? {}),
      });
    }
    await this.activity.recordActivity(workspace, {
      action: "open_banking.consent_started",
      entityType: "open_banking",
      entityId: consent.providerConnectionId ?? consent.provider,
      metadata: { provider: this.config.openBankingProvider },
    });
    return consent;
  }

  async completeMockConsent(workspace: CompanyWorkspace) {
    return this.completeConsentCallback(workspace, { code: "mock-consent", state: "mock", requisitionId: "mock-connection" });
  }

  async completeConsentCallback(workspace: CompanyWorkspace, input: { code?: string | null; state?: string | null; requisitionId?: string | null }) {
    const adapter = this.adapter();
    const pendingConnection = await this.findPendingConnection(workspace, input.state);
    const callback = await adapter.exchangeCallback({
      ...input,
      code: input.code ?? pendingConnection?.providerConnectionId,
      requisitionId: input.requisitionId ?? (this.config.openBankingProvider === "gocardless" ? pendingConnection?.providerConnectionId : undefined),
    });
    const connection = pendingConnection
      ? await prisma.bankConnection.update({
        where: { id: pendingConnection.id },
        data: {
          providerConnectionId: callback.providerConnectionId,
          consentExpiresAt: new Date(callback.consentExpiresAt),
          status: "ACTIVE",
          metadataJson: {
            state: input.state ?? undefined,
            provider: this.config.openBankingProvider,
            ...(callback.metadata ?? {}),
          } as Prisma.InputJsonObject,
        },
      })
      : await this.upsertConnection(workspace, callback.providerConnectionId, callback.consentExpiresAt, "ACTIVE", {
        provider: this.config.openBankingProvider,
        ...(callback.metadata ?? {}),
      });
    await this.activity.recordActivity(workspace, {
      action: "open_banking.consent_completed",
      entityType: "bank_connection",
      entityId: connection.id,
      metadata: { provider: this.config.openBankingProvider, status: connection.status },
    });
    return connection;
  }

  async sync(workspace: CompanyWorkspace, connectionId?: string) {
    const started = await prisma.bankFeedSyncEvent.create({
      data: {
        companyId: workspace.company.id,
        fiscalYearId: workspace.fiscalYear.id,
        status: "STARTED",
        metadataJson: { provider: this.config.openBankingProvider } as Prisma.InputJsonObject,
      },
    });
    try {
      const connection = connectionId
        ? await this.requireConnection(workspace, connectionId)
        : await this.getOrCreateDefaultConnection(workspace);
      const payload = await this.adapter().sync({ providerConnectionId: connection.providerConnectionId });
      const normalized = this.normalizer.normalizeTransactions(payload.transactions);
      await this.upsertAccounts(workspace, connection.id, payload.accounts);
      const before = await prisma.transaction.count({ where: { fiscalYearId: workspace.fiscalYear.id } });
      const importResult = await new ImportOrchestrator({ meterUsage: false }).startCsvImport(workspace, {
        filename: `open-banking-${payload.providerConnectionId}.csv`,
        content: this.normalizer.toQontoCsv(normalized),
        sourceType: "OPEN_BANKING",
      });
      const after = await prisma.transaction.count({ where: { fiscalYearId: workspace.fiscalYear.id } });
      const imported = Math.max(0, after - before);
      const finished = await prisma.bankFeedSyncEvent.update({
        where: { id: started.id },
        data: {
          bankConnectionId: connection.id,
          status: "SUCCESS",
          finishedAt: new Date(),
          transactionsFetched: normalized.length,
          transactionsImported: imported,
          metadataJson: {
            provider: this.config.openBankingProvider,
            importId: importResult.import.id,
            importStatus: importResult.import.status,
          } as Prisma.InputJsonObject,
        },
      });
      await prisma.bankConnection.update({
        where: { id: connection.id },
        data: { lastSyncedAt: new Date(), consentExpiresAt: new Date(payload.consentExpiresAt), status: "ACTIVE" },
      });
      await new ReconciliationFreshnessCenter().getFreshness(workspace).catch(() => undefined);
      await this.activity.recordActivity(workspace, {
        action: "open_banking.sync_completed",
        entityType: "bank_connection",
        entityId: connection.id,
        metadata: { fetched: normalized.length, imported, importId: importResult.import.id },
      });
      this.metrics.recordCounter("open_banking.sync.completed", { provider: this.config.openBankingProvider });
      return { sync: finished, import: importResult.import, transactionsFetched: normalized.length, transactionsImported: imported };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Synchronisation Open Banking échouée.";
      const failed = await prisma.bankFeedSyncEvent.update({
        where: { id: started.id },
        data: { status: "FAILED", finishedAt: new Date(), errorCode: "OPEN_BANKING_SYNC_FAILED", errorMessage: message },
      });
      await this.activity.recordActivity(workspace, {
        action: "open_banking.sync_failed",
        entityType: "open_banking",
        entityId: failed.id,
        metadata: { message },
      });
      this.metrics.recordCounter("open_banking.sync.failed", { provider: this.config.openBankingProvider });
      throw err;
    }
  }

  async disconnect(workspace: CompanyWorkspace, connectionId?: string) {
    const connection = connectionId
      ? await this.requireConnection(workspace, connectionId)
      : await this.getOrCreateDefaultConnection(workspace);
    await this.adapter().disconnect({ providerConnectionId: connection.providerConnectionId });
    const updated = await prisma.bankConnection.update({ where: { id: connection.id }, data: { status: "REVOKED" } });
    await this.activity.recordActivity(workspace, {
      action: "open_banking.consent_revoked",
      entityType: "bank_connection",
      entityId: connection.id,
      metadata: { provider: this.config.openBankingProvider },
    });
    return updated;
  }

  private async getOrCreateDefaultConnection(workspace: CompanyWorkspace) {
    const existing = await prisma.bankConnection.findFirst({
      where: { companyId: workspace.company.id, provider: providerEnum(this.config.openBankingProvider), status: { not: "REVOKED" } },
      orderBy: { createdAt: "desc" },
    });
    if (existing) return existing;
    if (this.config.openBankingProvider !== "mock") throw new ExpectedRouteError("Aucune connexion bancaire active. Lance la connexion Open Banking d'abord.", 409);
    return this.completeMockConsent(workspace);
  }

  private async requireConnection(workspace: CompanyWorkspace, connectionId: string) {
    const connection = await prisma.bankConnection.findFirst({ where: { id: connectionId, companyId: workspace.company.id } });
    if (!connection) throw new ExpectedRouteError("Connexion Open Banking introuvable.", 404);
    if (connection.status === "REVOKED") throw new ExpectedRouteError("Connexion Open Banking révoquée.", 409);
    if (connection.status === "PENDING") throw new ExpectedRouteError("Connexion Open Banking en attente de consentement bancaire.", 409);
    return connection;
  }

  private async findPendingProviderConnectionId(workspace: CompanyWorkspace, state?: string | null) {
    return (await this.findPendingConnection(workspace, state))?.providerConnectionId;
  }

  private async findPendingConnection(workspace: CompanyWorkspace, state?: string | null) {
    if (!state) return undefined;
    const connection = await prisma.bankConnection.findFirst({
      where: {
        companyId: workspace.company.id,
        provider: providerEnum(this.config.openBankingProvider),
        status: "PENDING",
      },
      orderBy: { createdAt: "desc" },
    });
    if (connection && typeof connection.metadataJson === "object" && !Array.isArray(connection.metadataJson) && connection.metadataJson && "state" in connection.metadataJson && connection.metadataJson.state === state) {
      return connection;
    }
    return undefined;
  }

  private async upsertConnection(workspace: CompanyWorkspace, providerConnectionId: string, consentExpiresAt: string, status: "PENDING" | "ACTIVE" = "ACTIVE", metadata: Prisma.InputJsonObject = { source: "provider" }) {
    return prisma.bankConnection.upsert({
      where: {
        companyId_provider_providerConnectionId: {
          companyId: workspace.company.id,
          provider: providerEnum(this.config.openBankingProvider),
          providerConnectionId,
        },
      },
      create: {
        companyId: workspace.company.id,
        provider: providerEnum(this.config.openBankingProvider),
        providerConnectionId,
        status,
        consentExpiresAt: new Date(consentExpiresAt),
        metadataJson: metadata,
      },
      update: { status, consentExpiresAt: new Date(consentExpiresAt), metadataJson: metadata },
    });
  }

  private async upsertAccounts(workspace: CompanyWorkspace, bankConnectionId: string, accounts: Array<{ providerAccountId: string; name: string; ibanMasked?: string; currency: string; status?: string; balance?: number }>) {
    for (const account of accounts) {
      await prisma.bankFeedAccount.upsert({
        where: { bankConnectionId_providerAccountId: { bankConnectionId, providerAccountId: account.providerAccountId } },
        create: {
          companyId: workspace.company.id,
          bankConnectionId,
          providerAccountId: account.providerAccountId,
          ibanMasked: account.ibanMasked,
          name: account.name,
          currency: account.currency,
          status: account.status ?? "ACTIVE",
          metadataJson: { balance: account.balance } as Prisma.InputJsonObject,
        },
        update: {
          ibanMasked: account.ibanMasked,
          name: account.name,
          currency: account.currency,
          status: account.status ?? "ACTIVE",
          metadataJson: { balance: account.balance } as Prisma.InputJsonObject,
        },
      });
    }
  }

  private adapter() {
    return this.provider ?? createOpenBankingProviderAdapter(this.config);
  }

  private providerInfo() {
    if (this.config.openBankingProvider === "disabled") return { providerLabel: "Open Banking désactivé", selectionMode: "provider_webview" as const };
    return this.adapter().getInfo();
  }

  private isConfigured() {
    if (this.config.openBankingProvider === "mock") return true;
    if (this.config.openBankingProvider === "gocardless") return Boolean(this.config.openBankingClientId && this.config.openBankingClientSecret);
    if (this.config.openBankingProvider === "powens") {
      return Boolean(this.config.openBankingBaseUrl && this.config.openBankingClientId && this.config.openBankingClientSecret && this.config.openBankingWebhookSecret && this.providerVaultConfigured());
    }
    if (this.config.openBankingProvider === "bridge") {
      return Boolean(this.config.openBankingClientId && this.config.openBankingClientSecret && this.config.openBankingWebhookSecret && this.providerVaultConfigured());
    }
    return this.config.openBankingProvider !== "disabled" && Boolean(this.config.openBankingClientId && this.config.openBankingClientSecret && this.config.openBankingWebhookSecret);
  }

  private statusMessage() {
    if (this.config.openBankingProvider === "disabled") return "Open Banking désactivé : les imports CSV restent la source par défaut.";
    if (this.config.openBankingProvider === "mock") return "Open Banking mock actif pour validation locale.";
    return this.isConfigured() ? "Provider Open Banking configuré." : "Provider Open Banking incomplet.";
  }

  private providerVaultConfigured() {
    return this.config.appEnv === "local" || Boolean(this.config.providerSecretEncryptionKey);
  }

  private defaultRedirectUri() {
    const base = this.config.openBankingRedirectUri ?? this.config.publicAppUrl;
    if (!base) return "http://localhost:5173/api/open-banking/callback";
    return `${base.replace(/\/+$/, "")}/api/open-banking/callback`;
  }
}

function providerEnum(provider: RuntimeConfig["openBankingProvider"]) {
  if (provider === "disabled") throw new ExpectedRouteError("Open Banking désactivé.", 409);
  if (provider === "mock") return "MOCK" as const;
  return provider.toUpperCase() as "BRIDGE" | "POWENS" | "GOCARDLESS" | "TINK" | "YAPILY";
}

function effectiveConnectionStatus(status: string, consentExpiresAt: Date | null) {
  if (status === "ACTIVE" && consentExpiresAt && consentExpiresAt.getTime() < Date.now()) return "EXPIRED";
  return status;
}

function addDays(days: number) {
  return new Date(Date.now() + days * 86_400_000);
}

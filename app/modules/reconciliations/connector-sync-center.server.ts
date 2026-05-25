import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { Prisma } from "@prisma/client";
import { ActivityLogCenter } from "../activity-log/activity-log-center.server";
import { AccountingReferencePolicyCenter } from "../accounting-reference/accounting-reference-policy-center.server";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { ImportOrchestrator } from "../import-orchestrator/import-orchestrator.server";
import { MetricsCenter } from "../monitoring/monitoring-center.server";
import { BankFeedNormalizer } from "../open-banking/bank-feed-normalizer.server";
import { ExpectedRouteError } from "../route-errors.server";
import { getRuntimeConfig, type RuntimeConfig } from "../runtime-config.server";
import { QontoConnectorAdapter } from "./qonto-connector-adapter.server";
import { ReconciliationFreshnessCenter } from "./reconciliation-freshness-center.server";
import { StripeConnectorAdapter } from "./stripe-connector-adapter.server";
import { StripeReconciliationCenter } from "./stripe-reconciliation-center.server";

const execFileAsync = promisify(execFile);

export type ConnectorSyncResult = {
  provider: "qonto" | "stripe";
  mode: "disabled" | "fixture" | "live";
  stdout?: string;
  stderr?: string;
  imported?: unknown;
};

export type ConnectorStatus = {
  provider: "qonto" | "stripe";
  mode: "disabled" | "fixture" | "live";
  enabled: boolean;
  configured: boolean;
  source: "csv" | "fixture" | "live";
  message: string;
  safeMessage: string;
  lastSync: null;
};

export class ConnectorSyncCenter {
  constructor(
    private readonly config: RuntimeConfig = getRuntimeConfig(),
    private readonly runtime = new PaperasseConnectorRuntime(config),
    private readonly stripe = new StripeReconciliationCenter(),
    private readonly qontoAdapter = new QontoConnectorAdapter(config),
    private readonly stripeAdapter = new StripeConnectorAdapter(config),
    private readonly activity = new ActivityLogCenter(),
    private readonly metrics = new MetricsCenter(),
    private readonly normalizer = new BankFeedNormalizer()
  ) {}

  getConnectorStatus(_workspace?: CompanyWorkspace): { mode: "disabled" | "fixture" | "live"; connectors: ConnectorStatus[] } {
    const mode = this.config.connectorsMode ?? "disabled";
    return {
      mode,
      connectors: [
        {
          provider: "qonto",
          mode,
          enabled: mode !== "disabled",
          configured: mode === "fixture" || (mode === "live" && Boolean(this.config.qontoId && this.config.qontoApiSecret)),
          source: mode === "live" ? "live" : mode === "fixture" ? "fixture" : "csv",
          message: mode === "disabled" ? "Qonto live désactivé : les imports CSV restent la source locale." : mode === "fixture" ? "Mode fixture : les imports CSV locaux restent utilisés pour Qonto." : this.config.qontoId && this.config.qontoApiSecret ? "Qonto live configuré." : "Qonto live incomplet : variables d'environnement manquantes.",
          safeMessage: mode === "disabled" ? "Qonto live désactivé : les imports CSV restent la source locale." : mode === "fixture" ? "Mode fixture : les imports CSV locaux restent utilisés pour Qonto." : this.config.qontoId && this.config.qontoApiSecret ? "Qonto live configuré." : "Qonto live incomplet : variables d'environnement manquantes.",
          lastSync: null,
        },
        {
          provider: "stripe",
          mode,
          enabled: mode !== "disabled",
          configured: mode === "fixture" || (mode === "live" && Boolean(this.config.stripeConnectorSecret)),
          source: mode === "live" ? "live" : mode === "fixture" ? "fixture" : "fixture",
          message: mode === "disabled" ? "Stripe live désactivé : utilise la fixture locale." : mode === "fixture" ? "Mode fixture : import Stripe local disponible." : this.config.stripeConnectorSecret ? "Stripe live configuré." : "Stripe live incomplet : variable STRIPE_SECRET manquante.",
          safeMessage: mode === "disabled" ? "Stripe live désactivé : utilise la fixture locale." : mode === "fixture" ? "Mode fixture : import Stripe local disponible." : this.config.stripeConnectorSecret ? "Stripe live configuré." : "Stripe live incomplet : variable STRIPE_SECRET manquante.",
          lastSync: null,
        },
      ],
    };
  }

  assertConnectorConfig(provider: "qonto" | "stripe") {
    if ((this.config.connectorsMode ?? "disabled") !== "live") return true;
    if (provider === "qonto") this.assertQontoEnv();
    if (provider === "stripe") this.assertStripeEnv();
    return true;
  }

  async syncQonto(workspace: CompanyWorkspace): Promise<ConnectorSyncResult> {
    const mode = this.config.connectorsMode ?? "disabled";
    if (mode === "disabled") {
      throw new ExpectedRouteError("Connecteur Qonto désactivé. Active CONNECTORS_MODE=fixture ou live.", 409);
    }
    if (mode === "fixture") {
      return { provider: "qonto", mode: "fixture", imported: { message: "Les imports CSV restent la source locale Qonto." } };
    }
    this.assertConnectorConfig("qonto");
    const started = await this.startSyncEvent(workspace, "qonto");
    try {
      const payload = await this.qontoAdapter.sync({ fiscalYearStart: workspace.fiscalYear.startDate, fiscalYearEnd: workspace.fiscalYear.endDate });
      let imported = 0;
      for (const account of payload.accounts) {
        const bankAccountId = await this.upsertBankAccount(workspace, account);
        const transactions = payload.transactions.filter((transaction) => transaction.providerAccountId === account.providerAccountId);
        if (transactions.length === 0) continue;
        const before = await prisma.transaction.count({ where: { fiscalYearId: workspace.fiscalYear.id } });
        await new ImportOrchestrator({ meterUsage: false }).startCsvImport(workspace, {
          filename: `qonto-${account.providerAccountId}.csv`,
          content: this.normalizer.toQontoCsv(this.normalizer.normalizeTransactions(transactions)),
          sourceType: "QONTO_API",
          bankAccountId,
        });
        const after = await prisma.transaction.count({ where: { fiscalYearId: workspace.fiscalYear.id } });
        imported += Math.max(0, after - before);
      }
      await this.finishSyncEvent(started.id, "SUCCESS", payload.transactions.length, imported, { provider: "qonto", accounts: payload.accounts.length });
      await new ReconciliationFreshnessCenter().getFreshness(workspace).catch(() => undefined);
      await this.activity.recordActivity(workspace, { action: "connector.qonto_synced", entityType: "connector", entityId: "qonto", metadata: { fetched: payload.transactions.length, imported, accounts: payload.accounts.length } });
      this.metrics.recordCounter("connector.qonto.sync.completed");
      return { provider: "qonto", mode: "live", imported: { fetched: payload.transactions.length, imported, accounts: payload.accounts.length } };
    } catch (error) {
      await this.failSyncEvent(started.id, error);
      await this.activity.recordActivity(workspace, { action: "connector.qonto_sync_failed", entityType: "connector", entityId: "qonto", metadata: { message: error instanceof Error ? error.message : "Qonto sync failed" } });
      this.metrics.recordCounter("connector.qonto.sync.failed");
      throw error;
    }
  }

  async syncStripe(workspace: CompanyWorkspace): Promise<ConnectorSyncResult> {
    const mode = this.config.connectorsMode ?? "disabled";
    if (mode === "disabled") {
      throw new ExpectedRouteError("Connecteur Stripe désactivé. Utilise l'import fixture ou CONNECTORS_MODE=live.", 409);
    }
    if (mode === "fixture") {
      return { provider: "stripe", mode: "fixture", imported: await this.stripe.importStripeFixture(workspace) };
    }
    this.assertConnectorConfig("stripe");
    const started = await this.startSyncEvent(workspace, "stripe");
    try {
      const payload = await this.stripeAdapter.sync({ fiscalYearStart: workspace.fiscalYear.startDate, fiscalYearEnd: workspace.fiscalYear.endDate });
      const imported = await this.stripe.importStripeLiveData(workspace, payload);
      await this.finishSyncEvent(started.id, "SUCCESS", payload.balanceTransactions.length + payload.payouts.length, imported.events + imported.payouts, { provider: "stripe", unknown: imported.unknown });
      await new ReconciliationFreshnessCenter().getFreshness(workspace).catch(() => undefined);
      await this.activity.recordActivity(workspace, { action: "connector.stripe_synced", entityType: "connector", entityId: "stripe", metadata: imported });
      this.metrics.recordCounter("connector.stripe.sync.completed");
      return { provider: "stripe", mode: "live", imported };
    } catch (error) {
      await this.failSyncEvent(started.id, error);
      await this.activity.recordActivity(workspace, { action: "connector.stripe_sync_failed", entityType: "connector", entityId: "stripe", metadata: { message: error instanceof Error ? error.message : "Stripe sync failed" } });
      this.metrics.recordCounter("connector.stripe.sync.failed");
      throw error;
    }
  }

  private async startSyncEvent(workspace: CompanyWorkspace, provider: "qonto" | "stripe") {
    return prisma.bankFeedSyncEvent.create({
      data: {
        companyId: workspace.company.id,
        fiscalYearId: workspace.fiscalYear.id,
        status: "STARTED",
        metadataJson: { provider } as Prisma.InputJsonObject,
      },
    });
  }

  private async finishSyncEvent(id: string, status: "SUCCESS", fetched: number, imported: number, metadata: Prisma.InputJsonObject) {
    return prisma.bankFeedSyncEvent.update({
      where: { id },
      data: {
        status,
        finishedAt: new Date(),
        transactionsFetched: fetched,
        transactionsImported: imported,
        metadataJson: metadata,
      },
    });
  }

  private async failSyncEvent(id: string, error: unknown) {
    return prisma.bankFeedSyncEvent.update({
      where: { id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        errorCode: "CONNECTOR_SYNC_FAILED",
        errorMessage: error instanceof Error ? error.message : "Synchronisation connecteur échouée.",
      },
    });
  }

  private async upsertBankAccount(workspace: CompanyWorkspace, account: { providerAccountId: string; name: string; ibanMasked?: string }) {
    const iban = account.providerAccountId.startsWith("FR") ? account.providerAccountId : null;
    const existing = iban
      ? await prisma.bankAccount.findFirst({ where: { companyId: workspace.company.id, iban } })
      : await prisma.bankAccount.findFirst({ where: { companyId: workspace.company.id, bank: "Qonto", label: account.name } });
    if (existing) return existing.id;
    const policy = new AccountingReferencePolicyCenter();
    const [bank, bankFec] = await Promise.all([
      policy.getAccountRole("bank"),
      policy.getAccountRole("bank_fec"),
    ]);
    const created = await prisma.bankAccount.create({
      data: {
        companyId: workspace.company.id,
        bank: "Qonto",
        label: account.name,
        iban,
        pcgAccount: bank.account,
        fecAccount: bankFec.account,
      },
    });
    return created.id;
  }

  private assertQontoEnv() {
    if (!this.config.qontoId || !this.config.qontoApiSecret) {
      throw new ExpectedRouteError("Connecteur Qonto live incomplet : QONTO_ID et QONTO_API_SECRET sont requis.", 500);
    }
  }

  private assertStripeEnv() {
    if (!this.config.stripeConnectorSecret) {
      throw new ExpectedRouteError("Connecteur Stripe live incomplet : STRIPE_SECRET est requis.", 500);
    }
  }
}

export class PaperasseConnectorRuntime {
  constructor(private readonly config: RuntimeConfig = getRuntimeConfig()) {}

  async runConnector(provider: "qonto" | "stripe") {
    const script = path.resolve(this.config.paperasseRepoPath, "integrations", provider, "fetch.js");
    try {
      const result = await execFileAsync("node", [script], {
        timeout: 60_000,
        env: process.env,
        cwd: path.resolve(this.config.paperasseRepoPath),
      });
      return { stdout: result.stdout, stderr: result.stderr };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Connecteur Qitus en échec.";
      throw new ExpectedRouteError(message, 502);
    }
  }
}

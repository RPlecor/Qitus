import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { HealthCheckCenter } from "./health-check-center.server";
import { DeploymentRuntimeCenter } from "./deployment-runtime-center.server";
import { SecurityHardeningCenter } from "./security-hardening-center.server";
import { StorageConfigurationCenter } from "./storage-configuration-center.server";
import { WorkerRuntimeCenter } from "./worker-runtime-center.server";
import { MetricCatalog } from "./metric-catalog.server";
import { OpenBankingCenter } from "../open-banking/open-banking-center.server";
import { StorageAuditCenter } from "../storage/storage-audit-center.server";
import { getRuntimeConfig, type RuntimeConfig } from "../runtime-config.server";
import { QontoPaReadinessCenter } from "../e-invoices/qonto-pa-readiness-center.server";
import { FecPrecheckCenter } from "../expert-dossier/fec-precheck-center.server";
import { OfficialReferenceCenter } from "../official-references/official-reference-center.server";
import { TaxPackageDraftCenter } from "../tax-package/tax-package-draft-center.server";

export type BetaReadinessSeverity = "ready" | "warning" | "blocked";

export type BetaReadinessCheck = {
  code: string;
  label: string;
  status: BetaReadinessSeverity;
  message: string;
  action?: string;
};

export class BetaReadinessCenter {
  constructor(private readonly config: RuntimeConfig = getRuntimeConfig()) {}

  async getReadiness(workspace: CompanyWorkspace) {
    const checks = await this.listChecks(workspace);
    const blocked = checks.filter((check) => check.status === "blocked");
    const warnings = checks.filter((check) => check.status === "warning");
    return {
      status: blocked.length > 0 ? "blocked" as const : warnings.length > 0 ? "warning" as const : "ready" as const,
      checkedAt: new Date().toISOString(),
      summary: { total: checks.length, blocked: blocked.length, warnings: warnings.length, ready: checks.length - blocked.length - warnings.length },
      checks,
      recommendedActions: this.getRecommendedActionsFromChecks(checks),
    };
  }

  async listChecks(workspace: CompanyWorkspace): Promise<BetaReadinessCheck[]> {
    const [runtime, health, security, openBanking, storageAudit, metricCatalog, qontoPaReadiness, accountingReferences, fecPrecheck, taxPackage] = await Promise.all([
      Promise.resolve(new DeploymentRuntimeCenter(this.config).getRuntimeReport()),
      new HealthCheckCenter(this.config).getReadiness(),
      Promise.resolve(new SecurityHardeningCenter(this.config).getSecurityStatus()),
      new OpenBankingCenter(this.config).getStatus(workspace),
      new StorageAuditCenter(this.config).getStorageAudit(workspace),
      Promise.resolve(new MetricCatalog().assertRequiredMetricsPresent()),
      new QontoPaReadinessCenter(this.config).getReadiness(),
      new OfficialReferenceCenter().getReferenceReadinessAsync(),
      new FecPrecheckCenter().getFecPrecheck(workspace).catch((error) => ({ status: "blocked" as const, message: error instanceof Error ? error.message : "FEC indisponible." })),
      new TaxPackageDraftCenter().getTaxPackageSummary(workspace).catch((error) => ({ status: "blocked" as const, completeness: null, documentId: null, message: error instanceof Error ? error.message : "Liasse indisponible." })),
    ]);
    const storage = new StorageConfigurationCenter(this.config).getStatus();
    const worker = new WorkerRuntimeCenter(this.config).getRuntimeStatus();

    return [
      {
        code: "runtime_config",
        label: "Configuration runtime",
        status: runtime.status === "ready" ? "ready" : "blocked",
        message: runtime.status === "ready" ? "Configuration runtime valide." : runtime.errors.join(" "),
        action: runtime.status === "ready" ? undefined : "Compléter les variables d'environnement beta.",
      },
      {
        code: "dependencies",
        label: "Dépendances runtime",
        status: health.status === "ready" ? "ready" : "blocked",
        message: health.status === "ready" ? "DB, storage et dépendances répondent." : health.dependencies.filter((item) => item.status === "error").map((item) => `${item.name}: ${item.message}`).join("; "),
        action: health.status === "ready" ? undefined : "Corriger les dépendances en erreur puis relancer /readyz.",
      },
      {
        code: "storage_config",
        label: "Stockage documents et pièces",
        status: storage.configured ? storageAudit.summary.missing > 0 ? "warning" : "ready" : "blocked",
        message: storage.configured
          ? `${storage.mode.toUpperCase()} configuré, ${storageAudit.summary.missing} artefact(s) manquant(s).`
          : "Stockage incomplet.",
        action: storage.configured ? undefined : "Configurer le stockage local ou S3-compatible.",
      },
      {
        code: "workers_cron",
        label: "Workers et cron",
        status: worker.worker.required && !worker.worker.redisConfigured ? "blocked" : worker.cron.required ? "warning" : "ready",
        message: `${worker.worker.message} ${worker.cron.message}`,
        action: worker.worker.required || worker.cron.required ? "Démarrer npm run worker:all en beta." : undefined,
      },
      {
        code: "open_banking",
        label: "Open Banking",
        status: openBanking.configured || !openBanking.enabled ? "ready" : "blocked",
        message: openBanking.message,
        action: openBanking.enabled && !openBanking.configured ? "Configurer le provider ou repasser OPEN_BANKING_PROVIDER=mock/disabled." : undefined,
      },
      {
        code: "qonto_pa",
        label: "Qonto PA",
        status: this.config.eInvoiceProvider !== "qonto_pa" ? "ready" : qontoPaReadiness.status === "blocked" ? "blocked" : qontoPaReadiness.status === "ready" ? "ready" : "warning",
        message: this.config.eInvoiceProvider !== "qonto_pa" ? "Qonto PA non sélectionnée comme provider actif." : qontoPaReadiness.message,
        action: this.config.eInvoiceProvider === "qonto_pa" ? qontoPaReadiness.recommendedAction : undefined,
      },
      {
        code: "accounting_references",
        label: "Référentiels comptables",
        status: accountingReferences.status,
        message: accountingReferences.status === "ready"
          ? `${accountingReferences.summary.ready}/${accountingReferences.summary.total} référentiels Qitus sont validés.`
          : `${accountingReferences.summary.blocked} référentiel(s) bloqué(s), ${accountingReferences.summary.warning} à surveiller.`,
        action: accountingReferences.status === "ready" ? undefined : "Ouvrir Référentiels Qitus et corriger les référentiels bloqués.",
      },
      {
        code: "fiscal_outputs",
        label: "Sorties fiscales",
        status: fecPrecheck.status === "blocked" || taxPackage.status === "missing" || taxPackage.status === "blocked" ? "blocked" : taxPackage.status === "to_complete" || fecPrecheck.status === "warning" ? "warning" : "ready",
        message: fiscalOutputsMessage(fecPrecheck, taxPackage),
        action: fecPrecheck.status === "ready" && taxPackage.status === "ready" ? undefined : "Ouvrir Documents pour générer ou relire les sorties fiscales.",
      },
      {
        code: "webhooks",
        label: "Webhooks signés",
        status: webhookStatus(this.config),
        message: webhookMessage(this.config),
        action: webhookStatus(this.config) === "blocked" ? "Configurer les secrets webhook requis." : undefined,
      },
      {
        code: "secrets_redacted",
        label: "Secrets masqués",
        status: security.secretsRedacted ? "ready" : "blocked",
        message: security.secretsRedacted ? "Les statuts publics exposent uniquement une configuration sanitizée." : "Un statut expose des secrets.",
      },
      {
        code: "validations",
        label: "Validations beta",
        status: metricCatalog.ok ? "ready" : "warning",
        message: metricCatalog.message,
        action: "Exécuter validate:production-config, validate:open-banking et validate:beta-infra avant beta.",
      },
    ];
  }

  async assertBetaReady(workspace: CompanyWorkspace) {
    const readiness = await this.getReadiness(workspace);
    if (readiness.status === "blocked") {
      throw new Error(readiness.checks.filter((check) => check.status === "blocked").map((check) => `${check.label}: ${check.message}`).join("; "));
    }
    return readiness;
  }

  async getRecommendedActions(workspace: CompanyWorkspace) {
    const checks = await this.listChecks(workspace);
    return this.getRecommendedActionsFromChecks(checks);
  }

  private getRecommendedActionsFromChecks(checks: BetaReadinessCheck[]) {
    return checks
      .filter((check) => check.status !== "ready" && check.action)
      .map((check) => ({ code: check.code, label: check.label, action: check.action }));
  }
}

function webhookStatus(config: RuntimeConfig): BetaReadinessSeverity {
  if (config.appEnv !== "production" && config.openBankingProvider === "mock") return "ready";
  if (config.appEnv === "production" && config.authMode === "clerk" && !config.clerkWebhookSecret) return "blocked";
  if (config.billingMode === "stripe" && !config.stripeWebhookSecret) return "blocked";
  if (config.openBankingProvider !== "disabled" && config.openBankingProvider !== "mock" && config.openBankingProvider !== "gocardless" && !config.openBankingWebhookSecret) return "blocked";
  return "ready";
}

function webhookMessage(config: RuntimeConfig) {
  if (webhookStatus(config) === "ready") return "Secrets webhook requis présents ou non applicables.";
  return "Un ou plusieurs webhooks requis n'ont pas de secret configuré.";
}

function fiscalOutputsMessage(
  fec: { status: string; label?: string; message?: string },
  taxPackage: { status: string; completeness?: { totalCases: number; toComplete: number; blocked: number } | null; message?: string }
) {
  if (fec.status === "blocked") return fec.message ?? fec.label ?? "FEC non générable ou à corriger.";
  if (taxPackage.status === "missing") return "Liasse fiscale CERFA non générée.";
  if (taxPackage.status === "blocked") return taxPackage.message ?? "Liasse fiscale CERFA bloquée.";
  if (taxPackage.status === "to_complete") {
    return `${taxPackage.completeness?.totalCases ?? 0} cases CERFA modélisées, ${taxPackage.completeness?.toComplete ?? 0} à compléter.`;
  }
  return "FEC et liasse CERFA prêts pour la beta.";
}

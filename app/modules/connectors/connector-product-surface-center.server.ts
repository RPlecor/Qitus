import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { BetaReadinessCenter } from "../deployment/beta-readiness-center.server";
import { EInvoiceProviderCenter } from "../e-invoices/e-invoice-provider-center.server";
import { QontoPaReadinessCenter } from "../e-invoices/qonto-pa-readiness-center.server";
import { OpenBankingCenter } from "../open-banking/open-banking-center.server";
import { ConnectorSyncCenter } from "../reconciliations/connector-sync-center.server";
import { getRuntimeConfig, type RuntimeConfig } from "../runtime-config.server";

export type ProductConnectorState =
  | "Non configuré"
  | "À connecter"
  | "Connecté"
  | "Synchronisé"
  | "À reconnecter"
  | "Erreur configuration"
  | "PA en attente partenaire"
  | "Réception PA conforme";

export type ProductConnectorCard = {
  key: "qonto_banking" | "stripe" | "open_banking" | "qonto_pa";
  label: string;
  description: string;
  state: ProductConnectorState;
  configured: boolean;
  connected: boolean;
  primaryAction: { label: string; href: string; method?: "post" } | null;
  secondaryAction?: { label: string; href: string; method?: "post" } | null;
  message: string;
  details: Array<{ label: string; value: string }>;
};

export type InternalConnectorTestAction = {
  key: "open_banking" | "stripe" | "e_invoices" | "qonto_pa";
  label: string;
  description: string;
  href: string;
};

export class ConnectorProductSurfaceCenter {
  constructor(
    private readonly config: RuntimeConfig = getRuntimeConfig(),
    private readonly connectors = new ConnectorSyncCenter(config),
    private readonly openBanking = new OpenBankingCenter(config),
    private readonly eInvoiceProvider = new EInvoiceProviderCenter(),
    private readonly qontoPa = new QontoPaReadinessCenter(config),
    private readonly betaReadiness = new BetaReadinessCenter(config)
  ) {}

  async getConnectorOverview(workspace: CompanyWorkspace) {
    const [banking, payment, eInvoice, beta] = await Promise.all([
      this.getBankingConnectors(workspace),
      this.getPaymentConnectors(workspace),
      this.getEInvoiceConnector(workspace),
      this.betaReadiness.getReadiness(workspace),
    ]);
    const cards = [...banking, ...payment, eInvoice];
    const safeBeta = this.config.qitusInternalTestMode ? beta : sanitizeBetaReadiness(beta);
    return {
      cards,
      betaReadiness: safeBeta,
      internalTest: await this.getInternalTestSurface(workspace),
      summary: {
        total: cards.length,
        configured: cards.filter((card) => card.configured).length,
        connected: cards.filter((card) => card.connected).length,
        blocked: cards.filter((card) => card.state === "Erreur configuration" || card.state === "PA en attente partenaire").length,
      },
    };
  }

  async getBankingConnectors(workspace: CompanyWorkspace): Promise<ProductConnectorCard[]> {
    const [legacy, openBanking] = await Promise.all([
      Promise.resolve(this.connectors.getConnectorStatus(workspace)),
      this.openBanking.getStatus(workspace),
    ]);
    const qonto = legacy.connectors.find((connector) => connector.provider === "qonto");
    const qontoEnabled = this.config.qitusInternalTestMode ? qonto?.enabled ?? false : (this.config.connectorsMode ?? "disabled") === "live";
    const openBankingEnabled = this.config.qitusInternalTestMode ? openBanking.enabled : this.config.openBankingProvider !== "disabled" && this.config.openBankingProvider !== "mock";
    const openBankingConfigured = openBankingEnabled && openBanking.configured;
    const activeConnections = openBanking.connections.filter((connection) => connection.status === "ACTIVE").length;
    return [
      {
        key: "qonto_banking",
        label: "Qonto bancaire",
        description: "Importe les transactions Qonto via Business API.",
        state: productState(qontoEnabled && Boolean(qonto?.configured), false, qontoEnabled),
        configured: qontoEnabled && Boolean(qonto?.configured),
        connected: false,
        primaryAction: qontoEnabled ? { label: "Synchroniser Qonto", href: "/api/connectors/qonto/sync", method: "post" } : null,
        message: qontoEnabled && qonto?.configured ? "Qonto Business API est prêt pour importer les mouvements bancaires." : "Renseignez QONTO_ID et QONTO_API_SECRET pour activer le connecteur bancaire Qonto.",
        details: [
          { label: "Source comptable", value: "Transactions bancaires" },
          { label: "Pipeline", value: "Import Qitus existant" },
        ],
      },
      {
        key: "open_banking",
        label: "Open Banking",
        description: "Connecte les banques non-Qonto via un provider AISP.",
        state: openBankingEnabled ? activeConnections > 0 ? "Connecté" : openBankingConfigured ? "À connecter" : "Erreur configuration" : "Non configuré",
        configured: openBankingConfigured,
        connected: openBankingEnabled && activeConnections > 0,
        primaryAction: openBankingEnabled ? { label: openBanking.selectionMode === "provider_webview" ? "Ouvrir le parcours bancaire" : "Connecter une banque", href: "/api/open-banking/connect", method: "post" } : null,
        secondaryAction: openBankingEnabled ? { label: "Synchroniser", href: "/api/open-banking/sync", method: "post" } : null,
        message: openBankingConfigured ? "Provider bancaire configuré. Les transactions passent par le pipeline d'import Qitus." : "Choisissez et configurez un provider Open Banking pour les banques non-Qonto.",
        details: [
          { label: "Connexions actives", value: String(activeConnections) },
          { label: "Sélection banque", value: openBanking.selectionMode === "institution_select" ? "Liste d'établissements" : "Parcours provider" },
        ],
      },
    ];
  }

  async getPaymentConnectors(workspace: CompanyWorkspace): Promise<ProductConnectorCard[]> {
    const legacy = this.connectors.getConnectorStatus(workspace);
    const stripe = legacy.connectors.find((connector) => connector.provider === "stripe");
    const stripeEnabled = this.config.qitusInternalTestMode ? stripe?.enabled ?? false : (this.config.connectorsMode ?? "disabled") === "live";
    return [{
      key: "stripe",
      label: "Stripe",
      description: "Rapproche payouts, frais, refunds et transactions bancaires.",
      state: productState(stripeEnabled && Boolean(stripe?.configured), false, stripeEnabled),
      configured: stripeEnabled && Boolean(stripe?.configured),
      connected: false,
      primaryAction: stripeEnabled ? { label: "Synchroniser Stripe", href: "/api/connectors/stripe/sync", method: "post" } : null,
      message: stripeEnabled && stripe?.configured ? "Stripe est prêt pour le rapprochement des encaissements." : "Renseignez STRIPE_SECRET pour activer le rapprochement Stripe live.",
      details: [
        { label: "Usage", value: "Rapprochement uniquement" },
        { label: "Données", value: "Payouts, frais, refunds" },
      ],
    }];
  }

  async getEInvoiceConnector(workspace: CompanyWorkspace): Promise<ProductConnectorCard> {
    const [provider, qontoPa] = await Promise.all([
      this.eInvoiceProvider.getStatus(workspace),
      this.qontoPa.getReadiness(),
    ]);
    const activeConnection = provider.connections.some((connection) => connection.status === "ACTIVE");
    const testProviderHidden = !this.config.qitusInternalTestMode && ["mock", "sandbox", "generic_pa"].includes(this.config.eInvoiceProvider);
    const configured = testProviderHidden ? false : provider.configured;
    const state: ProductConnectorState = provider.readiness.receptionCompliant
      ? "Réception PA conforme"
      : qontoPa.status === "ready"
        ? "À connecter"
        : qontoPa.status === "blocked" || qontoPa.status === "contract_missing" || qontoPa.status === "sandbox_ready"
          ? "PA en attente partenaire"
          : configured
            ? activeConnection ? "Connecté" : "À connecter"
            : "Non configuré";
    return {
      key: "qonto_pa",
      label: "Qonto PA",
      description: "Réception des factures électroniques fournisseur via Plateforme Agréée.",
      state,
      configured,
      connected: configured && activeConnection,
      primaryAction: configured ? { label: "Connecter Qonto PA", href: "/api/e-invoice-providers/connect", method: "post" } : null,
      secondaryAction: configured ? { label: "Synchroniser les factures", href: "/api/e-invoice-providers/sync", method: "post" } : null,
      message: provider.readiness.receptionCompliant ? "Réception PA conforme active." : "Qonto PA est la cible prioritaire ; la conformité sera activée après validation partenaire.",
      details: [
        { label: "Statut partenaire", value: qontoPaStatusLabel(qontoPa.status) },
        { label: "Conformité réception", value: provider.readiness.receptionCompliant ? "Oui" : "Non" },
      ],
    };
  }

  async getInternalTestSurface(_workspace: CompanyWorkspace) {
    if (!this.config.qitusInternalTestMode) {
      return { enabled: false, banner: null, actions: [] as InternalConnectorTestAction[] };
    }
    return {
      enabled: true,
      banner: "Données simulées, non conformes production.",
      actions: [
        { key: "open_banking", label: "Tester un flux bancaire", description: "Crée et synchronise un flux bancaire de test.", href: "/api/internal-test/open-banking/sync" },
        { key: "stripe", label: "Tester un payout Stripe", description: "Charge des événements Stripe de test pour le rapprochement.", href: "/api/internal-test/stripe/import" },
        { key: "e_invoices", label: "Tester une facture entrante", description: "Synchronise une facture électronique de test.", href: "/api/internal-test/e-invoices/sync" },
        { key: "qonto_pa", label: "Vérifier Qonto PA", description: "Affiche la readiness Qonto PA sans appel réseau.", href: "/api/e-invoice-providers/qonto-pa/readiness" },
      ],
    };
  }
}

function sanitizeBetaReadiness<T extends { checks: Array<{ message: string; action?: string }> }>(beta: T): T {
  return {
    ...beta,
    checks: beta.checks.map((check) => ({
      ...check,
      message: sanitizeProductText(check.message),
      action: check.action ? sanitizeProductText(check.action) : check.action,
    })),
  };
}

function sanitizeProductText(value: string) {
  return value
    .replace(/mock/gi, "test interne")
    .replace(/fixture/gi, "test interne")
    .replace(/sandbox/gi, "pré-activation")
    .replace(/generic_pa/gi, "PA à sélectionner")
    .replace(/adapter/gi, "connecteur");
}

function productState(configured: boolean, connected: boolean, enabled: boolean): ProductConnectorState {
  if (!enabled) return "Non configuré";
  if (!configured) return "Erreur configuration";
  if (connected) return "Connecté";
  return "À connecter";
}

function qontoPaStatusLabel(status: string) {
  if (status === "ready") return "Contrat test validé";
  if (status === "blocked") return "Configuration partenaire incomplète";
  if (status === "sandbox_ready") return "Pré-activation partenaire à finaliser";
  if (status === "contract_missing") return "Contrat partenaire à obtenir";
  return "À vérifier";
}

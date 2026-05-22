import { getRuntimeConfig, type RuntimeConfig } from "../runtime-config.server";
import { QontoAccreditedPlatformAdapter } from "./providers/qonto-accredited-platform-adapter.server";

export type QontoPaReadinessStatus = "ready" | "blocked" | "sandbox_ready" | "contract_missing";

export type QontoPaReadinessCheck = {
  code: string;
  label: string;
  status: "ready" | "missing";
  action: string;
};

export class QontoPaReadinessCenter {
  constructor(private readonly config: RuntimeConfig = getRuntimeConfig()) {}

  async getReadiness() {
    const provider = await new QontoAccreditedPlatformAdapter(this.config).getStatus();
    const checks = this.listChecks(provider.missingConfig);
    const missing = checks.filter((check) => check.status === "missing");
    const status = this.status(missing);
    return {
      provider: "qonto_pa",
      providerLabel: "Qonto PA",
      status,
      configured: provider.configured,
      receptionCompliant: false,
      message: this.message(status),
      checks,
      missingConfig: provider.missingConfig,
      recommendedAction: missing[0]?.action ?? "Valider le contract test Qonto PA avant activation conforme.",
    };
  }

  private listChecks(missingConfig: string[]): QontoPaReadinessCheck[] {
    return [
      check("contract", "Contrat partenaire Qonto PA", false, "Obtenir le contrat et la documentation API PA réception fournisseur Qonto."),
      check("sandbox", "Accès sandbox Qonto PA", !missingConfig.includes("QONTO_PA_BASE_URL") && !missingConfig.includes("QONTO_PA_CLIENT_ID") && !missingConfig.includes("QONTO_PA_CLIENT_SECRET"), "Renseigner QONTO_PA_BASE_URL, QONTO_PA_CLIENT_ID et QONTO_PA_CLIENT_SECRET."),
      check("webhook_secret", "Webhook secret Qonto PA", !missingConfig.includes("QONTO_PA_WEBHOOK_SECRET"), "Configurer QONTO_PA_WEBHOOK_SECRET."),
      check("formats", "Formats entrants documentés", false, "Confirmer les payloads XML/PDF, formats UBL/CII/Factur-X et métadonnées de réception."),
      check("provider_statuses", "Statuts PA documentés", false, "Mapper les statuts Qonto PA vers le lifecycle Qitus."),
      check("acknowledgement", "Règles d'acquittement", false, "Confirmer si Qonto PA exige un retour de statut lecture/rejet/comptabilisation."),
      check("pagination", "Pagination et limites", false, "Documenter pagination, filtres de période et limites d'API."),
      check("proof_export", "Preuve de réception", false, "Confirmer les identifiants et horodatages à conserver dans le bundle."),
      check("vault", "Vault secrets provider", !missingConfig.includes("PROVIDER_SECRET_ENCRYPTION_KEY"), "Configurer PROVIDER_SECRET_ENCRYPTION_KEY en staging/production."),
    ];
  }

  private status(missing: QontoPaReadinessCheck[]): QontoPaReadinessStatus {
    if (missing.some((check) => check.code === "sandbox" || check.code === "webhook_secret" || check.code === "vault")) return "blocked";
    if (missing.some((check) => check.code === "contract")) return "contract_missing";
    if (missing.length > 0) return "sandbox_ready";
    return "ready";
  }

  private message(status: QontoPaReadinessStatus) {
    if (status === "blocked") return "Qonto PA est sélectionnée, mais la configuration sandbox est incomplète.";
    if (status === "contract_missing") return "Configuration sandbox présente, mais le contrat/API PA Qonto reste à valider.";
    if (status === "sandbox_ready") return "Sandbox Qonto PA prête côté secrets, mais le contract test reste à finaliser.";
    return "Qonto PA prête côté Qitus ; la réception conforme dépend du contract test PA validé.";
  }
}

function check(code: string, label: string, ok: boolean, action: string): QontoPaReadinessCheck {
  return { code, label, status: ok ? "ready" : "missing", action };
}

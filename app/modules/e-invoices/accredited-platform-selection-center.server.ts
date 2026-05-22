import { getRuntimeConfig, type RuntimeConfig } from "../runtime-config.server";
import { createEInvoiceProviderAdapter } from "./e-invoice-provider-adapter.server";
import { QontoPaReadinessCenter } from "./qonto-pa-readiness-center.server";

export type AccreditedPlatformSelectionStatus = "not_started" | "evaluating" | "sandbox_ready" | "selected" | "blocked";

export type AccreditedPlatformCandidate = {
  key: string;
  label: string;
  status: AccreditedPlatformSelectionStatus;
  docsReceived: boolean;
  sandboxAvailable: boolean;
  webhooks: boolean;
  formats: string[];
  slaKnown: boolean;
  pricingKnown: boolean;
  eReporting: boolean;
  proofExport: boolean;
  notes: string;
};

export class AccreditedPlatformSelectionCenter {
  constructor(private readonly config: RuntimeConfig = getRuntimeConfig()) {}

  async getSelection() {
    const providerStatus = await createEInvoiceProviderAdapter(this.config).getStatus();
    const qontoPaReadiness = await new QontoPaReadinessCenter(this.config).getReadiness();
    const candidates = this.listCandidates(qontoPaReadiness.status);
    const selected = candidates.find((candidate) => candidate.key === this.config.eInvoiceProvider) ?? null;
    return {
      configuredProvider: this.config.eInvoiceProvider,
      providerStatus,
      status: selected?.status ?? this.statusFromProvider(),
      selectedCandidate: selected,
      checklist: this.buildChecklist(providerStatus.configured),
      candidates,
      qontoPaReadiness,
      message: this.message(selected?.status ?? this.statusFromProvider()),
    };
  }

  listCandidates(qontoStatus: "ready" | "blocked" | "sandbox_ready" | "contract_missing" = "contract_missing"): AccreditedPlatformCandidate[] {
    const genericCandidates: AccreditedPlatformCandidate[] = [
      candidate("jefacture", "jefacture", "evaluating", "Candidat orienté cabinet/EC ; documentation et sandbox partenaire à obtenir."),
      candidate("pennylane_pa", "Pennylane PA", "evaluating", "Candidat SaaS comptable ; vérifier API réception, webhooks et export preuve."),
      candidate("sage_pa", "Sage PA", "evaluating", "Candidat ERP/compta ; vérifier compatibilité TPE/SaaS et conditions d'accès."),
    ];
    const qonto = candidate("qonto_pa", "Qonto PA", selectionStatusForQonto(qontoStatus), qontoNote(qontoStatus), {
      docsReceived: qontoStatus !== "blocked",
      sandboxAvailable: qontoStatus === "sandbox_ready" || qontoStatus === "ready",
      webhooks: qontoStatus === "sandbox_ready" || qontoStatus === "ready",
      formats: qontoStatus === "ready" ? ["UBL", "CII", "Factur-X"] : [],
      proofExport: qontoStatus === "ready",
    });
    const sandbox = candidate("sandbox", "Sandbox PA Qitus", "sandbox_ready", "Sandbox interne stricte, non conforme légalement.", {
      docsReceived: true,
      sandboxAvailable: true,
      webhooks: true,
      formats: ["UBL", "CII", "Factur-X-like"],
      proofExport: true,
    });
    const generic = candidate("generic_pa", "PA générique", this.config.eInvoiceProvider === "generic_pa" ? "evaluating" : "not_started", "Contrat Qitus prêt, Adapter concret non sélectionné.");
    return [qonto, sandbox, generic, ...genericCandidates];
  }

  private statusFromProvider(): AccreditedPlatformSelectionStatus {
    if (this.config.eInvoiceProvider === "sandbox") return "sandbox_ready";
    if (this.config.eInvoiceProvider === "disabled" || this.config.eInvoiceProvider === "mock") return "not_started";
    if (this.config.eInvoiceProvider === "generic_pa") return "evaluating";
    if (this.config.eInvoiceProvider === "qonto_pa") return "evaluating";
    return "selected";
  }

  private buildChecklist(configured: boolean) {
    return [
      check("Contrat PA identifié", this.statusFromProvider() === "selected", "Choisir une PA immatriculée et contractualiser l'accès."),
      check("Configuration provider", configured, "Renseigner les variables E_INVOICE_PROVIDER_* et le secret webhook."),
      check("Sandbox disponible", this.config.eInvoiceProvider === "sandbox" || this.statusFromProvider() === "selected", "Obtenir ou simuler un environnement sandbox."),
      check("Webhooks signés", Boolean(this.config.eInvoiceProviderWebhookSecret) || this.config.eInvoiceProvider === "sandbox" || this.config.eInvoiceProvider === "mock", "Configurer un secret webhook provider."),
      check("Formats structurés", true, "Qitus parse Factur-X, UBL et CII."),
      check("Export preuve", true, "Le bundle Qitus inclut XML, preuve provider, statuts et audit."),
      check("E-reporting cadré", false, "Hors scope tant qu'une PA réelle n'est pas sélectionnée."),
    ];
  }

  private message(status: AccreditedPlatformSelectionStatus) {
    if (status === "sandbox_ready") return "Sandbox PA prête pour valider les cas provider sans conformité légale.";
    if (status === "selected") return "Une PA réelle est sélectionnée côté configuration ; l'Adapter concret doit prouver son contrat.";
    if (status === "evaluating") return "PA en évaluation : contrat, sandbox et documentation restent à confirmer.";
    if (status === "blocked") return "Sélection PA bloquée : information provider manquante.";
    return "Aucune PA réelle sélectionnée.";
  }
}

function selectionStatusForQonto(status: "ready" | "blocked" | "sandbox_ready" | "contract_missing"): AccreditedPlatformSelectionStatus {
  if (status === "blocked") return "blocked";
  if (status === "sandbox_ready") return "sandbox_ready";
  if (status === "ready") return "selected";
  return "evaluating";
}

function qontoNote(status: "ready" | "blocked" | "sandbox_ready" | "contract_missing") {
  if (status === "blocked") return "Qonto PA est prioritaire, mais la configuration sandbox manque.";
  if (status === "sandbox_ready") return "Qonto PA est prioritaire ; secrets sandbox présents, contract test à finaliser.";
  if (status === "ready") return "Qonto PA est sélectionnée et prête côté contrat Qitus.";
  return "Qonto PA est prioritaire ; contrat/API PA réception fournisseur à obtenir.";
}

function candidate(
  key: string,
  label: string,
  status: AccreditedPlatformSelectionStatus,
  notes: string,
  overrides: Partial<AccreditedPlatformCandidate> = {}
): AccreditedPlatformCandidate {
  return {
    key,
    label,
    status,
    docsReceived: false,
    sandboxAvailable: false,
    webhooks: false,
    formats: [],
    slaKnown: false,
    pricingKnown: false,
    eReporting: false,
    proofExport: false,
    notes,
    ...overrides,
  };
}

function check(code: string, ok: boolean, action: string) {
  return { code, status: ok ? "ready" : "missing", action };
}

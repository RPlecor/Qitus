import { MetricsCenter } from "../monitoring/monitoring-center.server";

export type MetricCatalogItem = {
  name: string;
  domain: "imports" | "open_banking" | "documents" | "chat" | "billing" | "closing" | "deterministic";
  description: string;
  required: boolean;
};

const REQUIRED_METRICS: MetricCatalogItem[] = [
  { name: "import.completed", domain: "imports", description: "Imports terminés avec succès.", required: true },
  { name: "import.failed", domain: "imports", description: "Imports échoués.", required: true },
  { name: "open_banking.sync.completed", domain: "open_banking", description: "Synchronisations Open Banking terminées.", required: true },
  { name: "open_banking.sync.failed", domain: "open_banking", description: "Synchronisations Open Banking échouées.", required: true },
  { name: "document.generated", domain: "documents", description: "Documents générés.", required: true },
  { name: "document.failed", domain: "documents", description: "Générations documentaires échouées.", required: true },
  { name: "chat.reply.generated", domain: "chat", description: "Réponses chat générées.", required: true },
  { name: "billing.webhook.handled", domain: "billing", description: "Webhooks billing traités.", required: true },
  { name: "annual_closing.closed", domain: "closing", description: "Exercices clôturés.", required: true },
  { name: "deterministic.hit_rate", domain: "deterministic", description: "Part de décisions déterministes sans appel IA.", required: true },
];

export class MetricCatalog {
  constructor(private readonly metrics = new MetricsCenter()) {}

  listMetrics() {
    const operational = this.metrics.getOperationalMetrics();
    const observedNames = new Set(operational.latest.map((metric) => metric.name));
    return {
      metrics: REQUIRED_METRICS.map((metric) => ({
        ...metric,
        observed: observedNames.has(metric.name),
      })),
      alerts: this.localAlerts(operational.latest),
    };
  }

  assertRequiredMetricsPresent() {
    const catalog = this.listMetrics();
    const missing = catalog.metrics.filter((metric) => metric.required && !metric.observed);
    return {
      ok: true,
      missing,
      message: missing.length === 0
        ? "Catalogue métriques beta présent."
        : "Catalogue métriques beta présent ; certaines métriques ne sont pas encore observées dans ce process local.",
    };
  }

  private localAlerts(latest: Array<{ name: string; value: number }>) {
    const deterministicHitRate = [...latest].reverse().find((metric) => metric.name === "deterministic.hit_rate");
    if (!deterministicHitRate || deterministicHitRate.value >= 60) return [];
    return [{
      code: "deterministic_hit_rate_low",
      severity: "warning" as const,
      message: "Hit rate déterministe inférieur à 60 %.",
      value: deterministicHitRate.value,
    }];
  }
}

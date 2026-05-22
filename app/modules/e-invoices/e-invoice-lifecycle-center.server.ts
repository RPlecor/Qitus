import type { EInvoiceStatus } from "@prisma/client";
import type { EInvoiceProviderLifecycleStatus } from "./e-invoice-provider-adapter.server";

export class EInvoiceLifecycleCenter {
  toQitusStatus(providerStatus?: EInvoiceProviderLifecycleStatus | null, currentStatus?: EInvoiceStatus | string | null): EInvoiceStatus {
    if (currentStatus === "ACCOUNTED" || currentStatus === "ARCHIVED") return currentStatus;
    if (!providerStatus) return currentStatus as EInvoiceStatus ?? "RECEIVED";
    if (providerStatus === "ERROR" || providerStatus === "REJECTED" || providerStatus === "CANCELLED") return "NEEDS_REVIEW";
    if (providerStatus === "MATCHED") return "MATCHED";
    if (providerStatus === "ACCOUNTED") return "ACCOUNTING_DRAFT";
    return currentStatus === "PARSED" || currentStatus === "MATCHED" || currentStatus === "ACCOUNTING_DRAFT" ? currentStatus : "RECEIVED";
  }

  providerStatusLabel(providerStatus?: string | null) {
    const labels: Record<string, string> = {
      RECEIVED: "Reçue PA",
      AVAILABLE: "Disponible PA",
      READ: "Lue PA",
      MATCHED: "Rapprochée PA",
      ACCOUNTED: "Comptabilisée PA",
      REJECTED: "Rejetée PA",
      CANCELLED: "Annulée PA",
      ERROR: "Erreur PA",
    };
    return providerStatus ? labels[providerStatus] ?? providerStatus : "—";
  }

  mandateLabel(status?: string | null) {
    const labels: Record<string, string> = {
      UNKNOWN: "Mandat inconnu",
      PENDING: "Mandat à compléter",
      ACTIVE: "Mandat actif",
      EXPIRED: "Mandat expiré",
      REVOKED: "Mandat révoqué",
      ERROR: "Mandat en erreur",
    };
    return labels[status ?? "UNKNOWN"] ?? status ?? "Mandat inconnu";
  }
}

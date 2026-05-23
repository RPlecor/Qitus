export function reconciliationRunStatusLabel(status: string | null | undefined) {
  switch (status) {
    case "MISSING":
    case "missing":
      return "Jamais lancé";
    case "DRAFT":
      return "Brouillon";
    case "READY":
      return "Prêt";
    case "BLOCKED":
      return "Bloqué";
    case "COMPLETED":
      return "Terminé";
    case "MATCHED":
      return "Rapproché";
    case "DIFFERENCE":
      return "Écart à traiter";
    default:
      return "À traiter";
  }
}

export function reconciliationMatchStatusLabel(status: string | null | undefined) {
  switch (status) {
    case "AUTO_MATCHED":
      return "Rapproché automatiquement";
    case "USER_MATCHED":
      return "Rapproché manuellement";
    case "UNMATCHED":
      return "Non rapproché";
    case "IGNORED":
      return "Ignoré";
    case "DIFFERENCE":
      return "Écart à traiter";
    case "MATCHED":
      return "Rapproché";
    case "DRAFT":
      return "Brouillon";
    case "MISSING":
    case "missing":
      return "Jamais lancé";
    default:
      return "À vérifier";
  }
}

export function reconciliationIssueStatusLabel(status: string | null | undefined) {
  switch (status) {
    case "OPEN":
      return "Ouvert";
    case "RESOLVED":
      return "Résolu";
    case "IGNORED":
      return "Ignoré";
    default:
      return "À traiter";
  }
}

export function reconciliationSeverityLabel(severity: string | null | undefined) {
  switch (severity) {
    case "BLOCKING":
      return "Bloquant";
    case "WARNING":
      return "Avertissement";
    default:
      return "Information";
  }
}

export function reconciliationKindLabel(kind: string | null | undefined) {
  switch (kind) {
    case "BANK":
      return "Banque";
    case "STRIPE":
      return "Stripe";
    case "THIRD_PARTY":
      return "Tiers";
    case "SUSPENSE":
      return "Comptes d'attente";
    default:
      return "Rapprochement";
  }
}

export function reconciliationEntityTypeLabel(entityType: string | null | undefined) {
  switch (entityType) {
    case "transaction":
      return "Transaction";
    case "journalLine":
      return "Ligne comptable";
    case "stripePayout":
      return "Virement Stripe";
    case "stripeEvent":
      return "Événement Stripe";
    case "account":
      return "Compte";
    default:
      return "Élément";
  }
}

export function reconciliationIssueCodeLabel(code: string | null | undefined) {
  if (!code) return "Point à traiter";
  if (code.startsWith("BANK_UNMATCHED_TRANSACTION")) return "Transaction bancaire sans écriture";
  if (code.startsWith("BANK_UNMATCHED_LEDGER_LINE")) return "Ligne bancaire comptable sans transaction";
  if (code.startsWith("STRIPE_PAYOUT_UNMATCHED")) return "Virement Stripe non rapproché";
  if (code.startsWith("STRIPE_FEES")) return "Frais Stripe à comptabiliser";
  if (code.startsWith("STRIPE_REFUND")) return "Remboursement Stripe à vérifier";
  if (code.startsWith("STRIPE_DISPUTE")) return "Litige Stripe à vérifier";
  if (code.startsWith("THIRD_PARTY_OPEN_ITEM")) return "Solde tiers ouvert";
  if (code.startsWith("SUSPENSE_ACCOUNT_OPEN")) return "Compte d'attente ouvert";
  return "Point à traiter";
}

export function stripeEventTypeLabel(eventType: string | null | undefined) {
  switch (eventType) {
    case "CHARGE":
      return "Encaissement";
    case "FEE":
      return "Frais";
    case "REFUND":
      return "Remboursement";
    case "DISPUTE":
      return "Litige";
    case "PAYOUT":
      return "Virement";
    default:
      return "Événement";
  }
}

export function connectorModeLabel(mode: string | null | undefined) {
  switch (mode) {
    case "disabled":
      return "Désactivé";
    case "fixture":
      return "Test interne";
    case "live":
      return "Connecté";
    default:
      return "Non configuré";
  }
}

export function connectorSourceLabel(source: string | null | undefined) {
  switch (source) {
    case "csv":
      return "Import CSV";
    case "fixture":
      return "Données de test";
    case "live":
      return "Connecteur live";
    default:
      return "Non renseigné";
  }
}

export function connectorProviderLabel(provider: string | null | undefined) {
  switch (provider) {
    case "qonto":
      return "Qonto bancaire";
    case "stripe":
      return "Stripe";
    default:
      return "Connecteur";
  }
}

export function connectorMessageLabel(input: { provider?: string | null; mode?: string | null; configured?: boolean | null }) {
  if (input.provider === "qonto") {
    if (input.mode === "disabled") return "Qonto bancaire non connecté : les imports CSV restent disponibles.";
    if (input.mode === "fixture") return "Banc de test interne : les imports CSV locaux restent utilisés.";
    return input.configured ? "Qonto bancaire configuré." : "Configuration Qonto bancaire incomplète.";
  }
  if (input.provider === "stripe") {
    if (input.mode === "disabled") return "Stripe non connecté : le rapprochement peut être testé en mode interne.";
    if (input.mode === "fixture") return "Banc de test interne : import Stripe de test disponible.";
    return input.configured ? "Stripe configuré." : "Configuration Stripe incomplète.";
  }
  return "Statut du connecteur à vérifier.";
}

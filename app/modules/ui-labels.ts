import { attachmentStatusLabel, documentFreshnessStatusLabel, sanitizeUserFacingText } from "./product-language/product-language";

export function documentTypeLabel(type: string | null | undefined) {
  switch (type) {
    case "FEC":
      return "FEC";
    case "BALANCE":
      return "Balance";
    case "BILAN":
      return "Bilan";
    case "COMPTE_RESULTAT":
      return "Compte de résultat";
    case "PDF_BUNDLE":
      return "Dossier PDF";
    case "LIASSE_FISCALE":
      return "Liasse fiscale";
    case "EVIDENCE_BUNDLE":
      return "Dossier de preuves";
    case "TVA_DECLARATION":
      return "Déclaration TVA";
    default:
      return "Document";
  }
}

export function documentFormatLabel(format: string | null | undefined) {
  switch (format) {
    case "md":
    case "markdown":
      return "Markdown";
    case "txt":
      return "Texte";
    case "csv":
      return "CSV";
    case "pdf":
      return "PDF";
    case "json":
      return "Données";
    default:
      return format ? format.toUpperCase() : "—";
  }
}

export function storageModeLabel(mode: string | null | undefined) {
  switch (mode) {
    case "local":
      return "Local";
    case "s3":
      return "Stockage objet";
    default:
      return "Non configuré";
  }
}

export function readinessStatusLabel(status: string | null | undefined) {
  switch (status) {
    case "ready":
      return "Prêt";
    case "warning":
      return "À surveiller";
    case "error":
    case "blocked":
      return "Bloqué";
    default:
      return "À vérifier";
  }
}

export function syncStatusLabel(status: string | null | undefined) {
  switch (status) {
    case "STARTED":
      return "En cours";
    case "SUCCESS":
    case "COMPLETED":
      return "Terminé";
    case "FAILED":
      return "Échec";
    default:
      return "À vérifier";
  }
}

export function storageArtifactKindLabel(kind: string | null | undefined) {
  switch (kind) {
    case "document":
      return "Document";
    case "attachment":
      return "Pièce";
    default:
      return "Fichier";
  }
}

export function workpaperStatusLabel(status: string | null | undefined) {
  switch (status) {
    case "DRAFT":
      return "Brouillon";
    case "READY":
      return "Prêt";
    case "ARCHIVED":
      return "Archivé";
    default:
      return "À vérifier";
  }
}

export function closingAdjustmentStatusLabel(status: string | null | undefined) {
  switch (status) {
    case "DRAFT":
      return "Brouillon";
    case "APPROVED":
      return "Validée";
    case "REJECTED":
      return "Rejetée";
    case "READY":
      return "Prête";
    case "SUPERSEDED":
      return "Remplacée";
    default:
      return "À vérifier";
  }
}

export function closingAdjustmentKindLabel(kind: string | null | undefined) {
  switch (kind) {
    case "CCA":
      return "Charge constatée d'avance";
    case "DEPRECIATION":
      return "Amortissement";
    case "CORPORATE_TAX":
      return "Impôt sur les sociétés";
    case "FNP":
      return "Facture non parvenue";
    case "FAE":
      return "Facture à établir";
    case "PCA":
      return "Produit constaté d'avance";
    case "STOCK_VARIATION":
      return "Variation de stock";
    case "PROVISION":
      return "Provision";
    case "PROVISION_REVERSAL":
      return "Reprise de provision";
    case "LOAN_INTEREST_ACCRUAL":
      return "Intérêts d'emprunt courus";
    case "PAYROLL_ACCRUAL":
      return "Paie à payer";
    case "VAT_SETTLEMENT":
      return "Régularisation TVA";
    case "RECONCILIATION_DIFFERENCE":
      return "Écart de rapprochement";
    default:
      return "OD de clôture";
  }
}

export function privacyRequestKindLabel(kind: string | null | undefined) {
  switch (kind) {
    case "EXPORT":
      return "Export des données";
    case "SOFT_DELETE":
      return "Demande de suppression";
    case "ANONYMIZATION":
      return "Anonymisation";
    case "PURGE":
      return "Suppression définitive";
    default:
      return "Demande RGPD";
  }
}

export function privacyRequestStatusLabel(status: string | null | undefined) {
  switch (status) {
    case "REQUESTED":
      return "Demandée";
    case "PROCESSING":
      return "En traitement";
    case "DONE":
      return "Terminée";
    case "FAILED":
      return "Échec";
    default:
      return "À vérifier";
  }
}

export function snapshotStatusLabel(status: string | null | undefined) {
  switch (status) {
    case "DRAFT":
      return "Brouillon";
    case "SUBMITTED":
      return "Transmis";
    case "FINAL":
      return "Final";
    default:
      return "À vérifier";
  }
}

export function dossierSectionStatusLabel(status: string | null | undefined) {
  switch (status) {
    case "ready":
      return "Prêt";
    case "partial":
      return "Partiel";
    case "blocked":
      return "Bloqué";
    case "stale":
      return "À mettre à jour";
    default:
      return "À vérifier";
  }
}

export function riskLabel(risk: string | null | undefined) {
  switch (risk) {
    case "low":
      return "Faible";
    case "medium":
      return "Moyen";
    case "high":
      return "Élevé";
    default:
      return "À vérifier";
  }
}

export function expertReviewStatusLabel(status: string | null | undefined) {
  switch (status) {
    case "DRAFT":
      return "Brouillon";
    case "IN_REVIEW":
      return "En revue";
    case "CHANGES_REQUESTED":
      return "Corrections demandées";
    case "READY_FOR_SIGNOFF":
      return "Prêt à valider";
    case "SIGNED_OFF":
      return "Validé";
    case "CANCELLED":
      return "Annulé";
    default:
      return "À créer";
  }
}

export function expertReviewItemStatusLabel(status: string | null | undefined) {
  switch (status) {
    case "OPEN":
      return "Ouverte";
    case "ANSWERED":
      return "Répondue";
    case "RESOLVED":
      return "Résolue";
    case "WAIVED":
      return "Levée";
    default:
      return "À traiter";
  }
}

export function expertReviewSeverityLabel(severity: string | null | undefined) {
  switch (severity) {
    case "INFO":
      return "Information";
    case "WARNING":
      return "Avertissement";
    case "BLOCKING":
      return "Bloquant";
    default:
      return "À vérifier";
  }
}

export function eInvoiceStatusLabel(status: string | null | undefined) {
  switch (status) {
    case "RECEIVED":
      return "Reçue";
    case "PARSED":
      return "Lue";
    case "MATCHED":
      return "Rapprochée";
    case "ACCOUNTING_DRAFT":
      return "Brouillon comptable";
    case "ACCOUNTED":
      return "Comptabilisée";
    case "NEEDS_REVIEW":
      return "À revoir";
    case "ARCHIVED":
      return "Archivée";
    case "ERROR":
      return "Erreur";
    case "DRAFT":
      return "Brouillon";
    case "READY":
      return "Prêt";
    case "APPROVED":
      return "Approuvé";
    case "REJECTED":
      return "Rejeté";
    case "SUPERSEDED":
      return "Remplacé";
    default:
      return "À vérifier";
  }
}

export function eInvoiceFormatLabel(format: string | null | undefined) {
  switch (format) {
    case "FACTUR_X":
      return "Factur-X";
    case "UBL":
      return "UBL";
    case "CII":
      return "CII";
    case "UNKNOWN":
      return "Non reconnu";
    default:
      return "—";
  }
}

export function eInvoiceSourceLabel(source: string | null | undefined) {
  switch (source) {
    case "UPLOAD":
      return "Dépôt manuel";
    case "PROVIDER":
      return "Plateforme agréée";
    default:
      return "Source inconnue";
  }
}

export function eInvoiceProviderStatusLabel(status: string | null | undefined) {
  switch (status) {
    case "PENDING":
      return "En attente";
    case "ACTIVE":
      return "Active";
    case "EXPIRED":
      return "Expirée";
    case "ERROR":
      return "Erreur";
    case "REVOKED":
      return "Révoquée";
    case "READ":
      return "Lue";
    default:
      return status ? "Statut reçu" : "—";
  }
}

export function vatDeclarationStatusLabel(status: string | null | undefined) {
  switch (status) {
    case "DRAFT":
      return "Brouillon";
    case "SUPERSEDED":
      return "Remplacée";
    default:
      return "Brouillon";
  }
}

export function freshnessLabel(value: string | null | undefined) {
  if (!value) return "À jour";
  return documentFreshnessStatusLabel(value);
}

export function entityTypeLabel(value: string | null | undefined) {
  switch (value) {
    case "TRANSACTION":
    case "transaction":
      return "Transaction";
    case "JOURNAL_ENTRY":
    case "journalEntry":
      return "Écriture";
    case "journalLine":
      return "Ligne comptable";
    default:
      return "Élément";
  }
}

export function chatProviderLabel(value: string | null | undefined) {
  switch (value) {
    case "fake":
      return "mode de test";
    case "codex":
      return "Codex";
    case "disabled":
      return "désactivé";
    default:
      return value ? sanitizeUserFacingText(value) : "non configuré";
  }
}

export function attachmentStatusLabelForUser(status: string | null | undefined) {
  return attachmentStatusLabel(status ?? "UPLOADED");
}

export function fiscalYearStatusLabel(status: string | null | undefined) {
  switch (status) {
    case "OPEN":
      return "Ouvert";
    case "CLOSED":
      return "Clôturé";
    case "ARCHIVED":
      return "Archivé";
    default:
      return "À vérifier";
  }
}

export function categorizationSourceLabel(source: string | null | undefined) {
  switch (source) {
    case "CORRECTION_RULE":
      return "Règle utilisateur";
    case "VENDOR_LOOKUP":
      return "Référentiel fournisseur";
    case "PATTERN_MATCH":
      return "Motif détecté";
    case "AI":
      return "Assistant";
    case "MANUAL":
      return "Saisie manuelle";
    default:
      return "Suggestion";
  }
}

export function activityEntityTypeLabel(value: string | null | undefined) {
  switch (value) {
    case "attachment":
    case "ATTACHMENT":
      return "Pièce";
    case "bank_connection":
    case "BANK_CONNECTION":
      return "Connexion bancaire";
    case "billing":
    case "BILLING":
      return "Abonnement";
    case "closing_adjustment":
    case "CLOSING_ADJUSTMENT":
      return "OD de clôture";
    case "closing_workpaper":
    case "CLOSING_WORKPAPER":
      return "Feuille de travail";
    case "company":
    case "COMPANY":
      return "Entreprise";
    case "document":
    case "DOCUMENT":
      return "Document";
    case "e_invoice":
    case "E_INVOICE":
      return "Facture entrante";
    case "expert_dossier":
    case "EXPERT_DOSSIER":
      return "Dossier EC";
    case "import":
    case "IMPORT":
      return "Import";
    case "journal_entry":
    case "JOURNAL_ENTRY":
      return "Écriture";
    case "open_banking":
    case "OPEN_BANKING":
      return "Open Banking";
    case "reconciliation":
    case "RECONCILIATION":
      return "Rapprochement";
    case "rule_pack":
    case "RULE_PACK":
      return "Règles comptables";
    case "stripe":
    case "STRIPE":
      return "Stripe";
    case "transaction":
    case "TRANSACTION":
      return "Transaction";
    case "vat":
    case "VAT":
      return "TVA";
    default:
      return value ? "Élément" : "—";
  }
}

export function expertReviewSectionLabel(sectionCode: string | null | undefined) {
  switch (sectionCode) {
    case "general":
      return "Général";
    case "fec":
      return "FEC";
    case "journal_audit":
      return "Audit du journal";
    case "tax_package":
      return "Liasse fiscale";
    case "financial_statements":
      return "États financiers";
    case "vat":
      return "TVA";
    case "evidence":
      return "Justificatifs";
    case "reconciliations":
      return "Rapprochements";
    case "workpapers":
      return "Feuilles de travail";
    case "closing_adjustments":
      return "OD de clôture";
    case "annual_closing":
      return "Clôture annuelle";
    case "activity":
      return "Activité";
    case "expert_review":
      return "Revue expert-comptable";
    default:
      return sectionCode ? "Section dossier" : "Général";
  }
}

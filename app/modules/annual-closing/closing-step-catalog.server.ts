export const CLOSING_STEP_CODES = [
  "BALANCE_CHECK",
  "BANK_RECONCILIATION",
  "THIRD_PARTY_MATCHING",
  "PREPAID_ACCRUALS",
  "DEPRECIATION",
  "PROVISIONS",
  "VAT_REVIEW",
  "TAX_CALCULATION",
  "CLOSING_ADJUSTMENTS",
  "FINANCIAL_STATEMENTS",
  "TAX_PACKAGE",
  "EXPORT_ARCHIVE",
] as const;

export type ClosingStepCode = typeof CLOSING_STEP_CODES[number];

export type ClosingStepDefinition = {
  code: ClosingStepCode;
  index: number;
  title: string;
  detail: string;
  actionLabel: string;
  actionHref: string;
  skippable: boolean;
};

export const CLOSING_STEP_CATALOG: ClosingStepDefinition[] = [
  step("BALANCE_CHECK", 1, "Vérification balance", "Contrôle débit = crédit et anomalies de journal.", "Voir les écritures", "/ecritures"),
  step("BANK_RECONCILIATION", 2, "Rapprochement bancaire", "Comparer le solde comptable 5121 au solde du relevé.", "Saisir le solde", "/cloture/BANK_RECONCILIATION"),
  step("THIRD_PARTY_MATCHING", 3, "Lettrage tiers", "Vérifier les comptes tiers clients/fournisseurs présents dans le journal.", "Voir le détail", "/cloture/THIRD_PARTY_MATCHING", true),
  step("PREPAID_ACCRUALS", 4, "PCA / CCA", "Valider les OD de charges constatées d'avance.", "Voir les OD", "/controle"),
  step("DEPRECIATION", 5, "Amortissements", "Contrôler le registre d'immobilisations et les dotations.", "Immobilisations", "/immobilisations"),
  step("PROVISIONS", 6, "Provisions", "Documenter les risques éventuels, sans écriture automatique.", "Voir le détail", "/cloture/PROVISIONS", true),
  step("VAT_REVIEW", 7, "TVA annuelle", "Contrôler le régime TVA et les comptes de TVA.", "Voir le détail", "/cloture/VAT_REVIEW", true),
  step("TAX_CALCULATION", 8, "Calcul IS / IR", "Valider la proposition d'impôt déterministe.", "Voir les OD", "/controle"),
  step("CLOSING_ADJUSTMENTS", 9, "Écritures de clôture", "S'assurer que les OD nécessaires sont validées.", "Voir les écritures", "/ecritures?journal=OD"),
  step("FINANCIAL_STATEMENTS", 10, "États financiers", "Générer balance, bilan et compte de résultat.", "Documents", "/documents"),
  step("TAX_PACKAGE", 11, "Liasse fiscale", "Préparer la pré-liasse adaptée au régime fiscal.", "Voir le détail", "/cloture/TAX_PACKAGE"),
  step("EXPORT_ARCHIVE", 12, "Export et archivage", "Préparer FEC et paquet de preuve final.", "Archive", "/cloture/archive"),
];

export function getClosingStepDefinition(code: string) {
  const definition = CLOSING_STEP_CATALOG.find((step) => step.code === code);
  if (!definition) throw new Error(`Étape de clôture inconnue: ${code}`);
  return definition;
}

function step(code: ClosingStepCode, index: number, title: string, detail: string, actionLabel: string, actionHref: string, skippable = false): ClosingStepDefinition {
  return { code, index, title, detail, actionLabel, actionHref, skippable };
}

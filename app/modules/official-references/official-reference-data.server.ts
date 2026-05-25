import { ChartOfAccountsCenter } from "../accounting-reference/chart-of-accounts-center.server";
import {
  OFFICIAL_REFERENCE_KINDS,
  officialReferenceChecksum,
  type OfficialReferenceKind,
  type OfficialReferencePack,
  type OfficialReferenceSource,
  type OfficialReferenceValidation,
} from "./official-reference-types";

const CHECKED_AT = "2026-05-23T00:00:00.000Z";

export const OFFICIAL_REFERENCE_LABELS: Record<OfficialReferenceKind, string> = {
  chart_of_accounts: "Plan comptable général",
  vat: "TVA",
  fec: "FEC",
  tax_package_2033: "Pré-liasse 2033",
  tax_package_2050: "Pré-liasse 2050",
  closing_adjustments: "OD de clôture",
  fixed_assets: "Immobilisations",
  evidence: "Justificatifs",
  reconciliation: "Rapprochements",
  e_invoice: "Factures électroniques",
  retention: "Conservation des données",
};

const OFFICIAL_SOURCES = {
  ancPcg: "https://www.anc.gouv.fr/plan-comptable-general",
  bofipFec: "https://bofip.impots.gouv.fr/export/pdf/17097",
  impotsFec: "https://www.impots.gouv.fr/fichiers-standards-des-ecritures-comptables",
  impotsVatCa3: "https://www.impots.gouv.fr/formulaire/3310-ca3-sd/tva-et-taxes-assimilees-regime-du-reel-normal-mini-reel",
  impotsVatCa12: "https://www.impots.gouv.fr/professionnel/questions/je-suis-soumis-au-regime-simplifie-dimposition-la-tva-quelle-echeance-dois",
  impotsTax2033: "https://www.impots.gouv.fr/formulaire/2033-sd/liasse-bicsi-regime-rsi-tableaux-ndeg-2033-sd-2033-g-sd",
  impotsTax2050: "https://www.impots.gouv.fr/formulaire/2050-liasse/liasse-fiscale-du-regime-reel-normal-en-matiere-de-bic-et-dis",
  impotsEInvoice: "https://www.impots.gouv.fr/facturation-electronique-et-plateformes-agreees",
};

export type VatReferencePayload = typeof VAT_REFERENCE_PAYLOAD;
export type FecReferencePayload = typeof FEC_REFERENCE_PAYLOAD;
export type TaxPackageReferencePayload = typeof TAX_PACKAGE_2033_REFERENCE_PAYLOAD | typeof TAX_PACKAGE_2050_REFERENCE_PAYLOAD;
export type ClosingAdjustmentReferencePayload = typeof CLOSING_ADJUSTMENT_REFERENCE_PAYLOAD;
export type FixedAssetReferencePayload = typeof FIXED_ASSET_REFERENCE_PAYLOAD;
export type EvidenceReferencePayload = typeof EVIDENCE_REFERENCE_PAYLOAD;
export type ReconciliationReferencePayload = typeof RECONCILIATION_REFERENCE_PAYLOAD;
export type EInvoiceReferencePayload = typeof E_INVOICE_REFERENCE_PAYLOAD;
export type DataRetentionReferencePayload = typeof RETENTION_REFERENCE_PAYLOAD;

export const VAT_REFERENCE_PAYLOAD = {
  accountRoles: {
    vatDeductible: "44566",
    vatCollected: "44571",
    vatReverseCharge: "4452",
    vatPayable: "44551",
    vatCredit: "44567",
  },
  rates: [
    { value: "0.20", percent: 20, label: "20 %", accounts: ["44566", "44571"], effectiveFrom: "2026-01-01" },
    { value: "0.10", percent: 10, label: "10 %", accounts: ["44566", "44571"], effectiveFrom: "2026-01-01" },
    { value: "0.055", percent: 5.5, label: "5,5 %", accounts: ["44566", "44571"], effectiveFrom: "2026-01-01" },
    { value: "0.021", percent: 2.1, label: "2,1 %", accounts: ["44566", "44571"], effectiveFrom: "2026-01-01" },
    { value: "0", percent: 0, label: "0 %", accounts: [], effectiveFrom: "2026-01-01" },
    { value: "none", percent: null, label: "Aucune TVA", accounts: [], effectiveFrom: "2026-01-01" },
  ],
  natures: [
    { value: "DOMESTIC_PURCHASE", label: "Achat France", expectedVatAccounts: ["44566"], taxable: true },
    { value: "DOMESTIC_SALE", label: "Vente France", expectedVatAccounts: ["44571"], taxable: true },
    { value: "INTRACOM_PURCHASE", label: "Achat intracommunautaire", expectedVatAccounts: ["4452"], taxable: true },
    { value: "INTRACOM_SALE", label: "Vente intracommunautaire", expectedVatAccounts: [], taxable: false },
    { value: "REVERSE_CHARGE", label: "Autoliquidation", expectedVatAccounts: ["4452"], taxable: true },
    { value: "EXEMPT", label: "Exonéré", expectedVatAccounts: [], taxable: false },
    { value: "OUT_OF_SCOPE", label: "Hors champ", expectedVatAccounts: [], taxable: false },
  ],
  accounts: {
    deductible: "44566",
    collected: "44571",
    reverseCharge: "4452",
    payable: "44551",
    credit: "44567",
  },
  regimes: [
    { value: "FRANCHISE", label: "Franchise en base", forms: [], frequencies: [], requiresVatLines: false },
    { value: "REEL_NORMAL", label: "Régime réel normal", forms: ["CA3"], frequencies: ["monthly", "quarterly"], requiresVatLines: true },
    { value: "REEL_SIMPLIFIE", label: "Régime réel simplifié", forms: ["CA12"], frequencies: ["annual"], requiresVatLines: true, watchChangeFrom: "2027-01-01" },
  ],
  forms: [
    { code: "CA3", officialName: "3310-CA3-SD", label: "Déclaration CA3", sourceUrl: OFFICIAL_SOURCES.impotsVatCa3 },
    { code: "CA12", officialName: "CA12", label: "Déclaration annuelle CA12", sourceUrl: OFFICIAL_SOURCES.impotsVatCa12 },
  ],
  tolerances: {
    amountEpsilon: 0.01,
  },
  compatibilityRules: [
    { rule: "taxable_requires_positive_or_zero_rate", description: "Une opération taxable doit porter un taux TVA explicite." },
    { rule: "exempt_forbids_positive_rate", description: "Une opération exonérée ou hors champ ne doit pas porter de taux positif." },
    { rule: "real_regime_requires_445_lines", description: "Un régime réel doit produire des lignes TVA 445xx quand la période contient de la TVA." },
  ],
} as const;

export const FEC_REFERENCE_PAYLOAD = {
  columns: [
    "JournalCode",
    "JournalLib",
    "EcritureNum",
    "EcritureDate",
    "CompteNum",
    "CompteLib",
    "CompAuxNum",
    "CompAuxLib",
    "PieceRef",
    "PieceDate",
    "EcritureLib",
    "Debit",
    "Credit",
    "EcritureLet",
    "DateLet",
    "ValidDate",
    "Montantdevise",
    "Idevise",
  ],
  formats: {
    date: "YYYYMMDD",
    separator: "tabulation ou caractère conforme au fichier standard",
    decimal: "point ou virgule selon export, sans séparateur de milliers",
    encoding: "UTF-8",
  },
  controls: [
    "colonnes_obligatoires",
    "ordre_colonnes",
    "journal_present",
    "ecriture_num_present",
    "date_valide",
    "compte_pcg_connu",
    "debit_credit_non_vides",
    "ecriture_equilibree",
    "source_ecriture_traitee",
  ],
  naming: "FEC_<SIREN>_<date_cloture>.txt",
  sources: [OFFICIAL_SOURCES.impotsFec, OFFICIAL_SOURCES.bofipFec],
} as const;

const caseAmount = (
  table: string,
  code: string,
  label: string,
  accountPrefixes: readonly string[],
  balanceSide: "debit" | "credit",
  options: {
    requiredSource?: "journal" | "computed" | "manual" | "profile" | "vat";
    formula?: string;
    defaultStatus?: "calculée" | "à compléter" | "non applicable" | "bloquée";
    emptyBehavior?: "zero_if_no_movement" | "zero_if_balance_source_complete" | "manual_if_absent" | "not_applicable_if_absent";
    calculationFamily?: "income_statement" | "balance_sheet" | "fixed_assets" | "tax_adjustment" | "profile" | "manual";
  } = {},
) => ({
  table,
  code,
  label,
  accountPrefixes,
  balanceSide,
  type: "amount",
  requiredSource: options.requiredSource ?? "journal",
  formula: options.formula,
  defaultStatus: options.defaultStatus ?? "à compléter",
  emptyBehavior: options.emptyBehavior ?? inferEmptyBehavior(table, options.requiredSource),
  calculationFamily: options.calculationFamily ?? inferCalculationFamily(table, options.requiredSource),
});

const caseProfile = (table: string, code: string, label: string, type: "text" | "date" | "amount" = "text") => ({
  table,
  code,
  label,
  type,
  requiredSource: "profile",
  defaultStatus: "à compléter",
  emptyBehavior: "manual_if_absent",
  calculationFamily: "profile",
});

const caseManual = (table: string, code: string, label: string, type: "text" | "date" | "amount" | "boolean" = "amount") => ({
  table,
  code,
  label,
  type,
  requiredSource: "manual",
  defaultStatus: "à compléter",
  emptyBehavior: "manual_if_absent",
  calculationFamily: table.startsWith("2058") || table === "2033-D" ? "tax_adjustment" : "manual",
});

function inferCalculationFamily(table: string, requiredSource?: string) {
  if (requiredSource === "computed") return "income_statement";
  if (table === "2033-B" || table === "2052" || table === "2053") return "income_statement";
  if (table === "2033-C" || table === "2054" || table === "2055" || table === "2056") return "fixed_assets";
  if (table.startsWith("2058") || table === "2033-D") return "tax_adjustment";
  return "balance_sheet";
}

function inferEmptyBehavior(table: string, requiredSource?: string) {
  const family = inferCalculationFamily(table, requiredSource);
  if (family === "income_statement" || family === "fixed_assets") return "zero_if_no_movement";
  if (family === "balance_sheet") return "zero_if_balance_source_complete";
  if (family === "tax_adjustment") return "manual_if_absent";
  return "manual_if_absent";
}

const TAX_PACKAGE_2033_TABLES = ["2033-A", "2033-B", "2033-C", "2033-D", "2033-E", "2033-F", "2033-G"] as const;
const TAX_PACKAGE_2050_TABLES = ["2050", "2051", "2052", "2053", "2054", "2055", "2056", "2057", "2058-A", "2058-B", "2058-C"] as const;

const TAX_PACKAGE_2033_CASES = [
  caseProfile("2033-A", "2033A_001", "Dénomination de l'entreprise"),
  caseProfile("2033-A", "2033A_002", "SIREN"),
  caseProfile("2033-A", "2033A_003", "Adresse"),
  caseProfile("2033-A", "2033A_004", "Date de début d'exercice", "date"),
  caseProfile("2033-A", "2033A_005", "Date de fin d'exercice", "date"),
  caseAmount("2033-A", "2033A_010", "Capital souscrit non appelé", ["109"], "debit"),
  caseAmount("2033-A", "2033A_014", "Immobilisations incorporelles brutes", ["20"], "debit"),
  caseAmount("2033-A", "2033A_016", "Amortissements immobilisations incorporelles", ["280"], "credit"),
  caseAmount("2033-A", "2033A_028", "Immobilisations corporelles brutes", ["21"], "debit"),
  caseAmount("2033-A", "2033A_030", "Amortissements immobilisations corporelles", ["281"], "credit"),
  caseAmount("2033-A", "2033A_040", "Immobilisations financières", ["26", "27"], "debit"),
  caseAmount("2033-A", "2033A_044", "Stocks et en-cours", ["3"], "debit"),
  caseAmount("2033-A", "2033A_050", "Avances et acomptes versés", ["409"], "debit"),
  caseAmount("2033-A", "2033A_052", "Créances clients et comptes rattachés", ["41"], "debit"),
  caseAmount("2033-A", "2033A_056", "Autres créances", ["42", "43", "44", "45", "46", "47"], "debit"),
  caseAmount("2033-A", "2033A_060", "Valeurs mobilières de placement", ["50"], "debit"),
  caseAmount("2033-A", "2033A_064", "Disponibilités", ["51", "53"], "debit"),
  caseAmount("2033-A", "2033A_068", "Charges constatées d'avance", ["486"], "debit"),
  caseAmount("2033-A", "2033A_084", "Capital social ou individuel", ["101", "108"], "credit"),
  caseAmount("2033-A", "2033A_086", "Écarts de réévaluation", ["105"], "credit"),
  caseAmount("2033-A", "2033A_088", "Réserve légale", ["1061"], "credit"),
  caseAmount("2033-A", "2033A_090", "Réserves réglementées", ["1064"], "credit"),
  caseAmount("2033-A", "2033A_092", "Autres réserves", ["1068"], "credit"),
  caseAmount("2033-A", "2033A_096", "Report à nouveau", ["11"], "credit"),
  caseAmount("2033-A", "2033A_098", "Résultat de l'exercice", ["12"], "credit"),
  caseAmount("2033-A", "2033A_110", "Provisions réglementées", ["14"], "credit"),
  caseAmount("2033-A", "2033A_120", "Provisions pour risques et charges", ["15"], "credit"),
  caseAmount("2033-A", "2033A_136", "Emprunts et dettes financières", ["16"], "credit"),
  caseAmount("2033-A", "2033A_156", "Avances et acomptes reçus", ["419"], "credit"),
  caseAmount("2033-A", "2033A_164", "Dettes fournisseurs", ["40"], "credit"),
  caseAmount("2033-A", "2033A_166", "Dettes fiscales et sociales", ["43", "44"], "credit"),
  caseAmount("2033-A", "2033A_172", "Autres dettes", ["45", "46", "47"], "credit"),
  caseAmount("2033-A", "2033A_174", "Produits constatés d'avance", ["487"], "credit"),
  caseAmount("2033-B", "2033B_209", "Ventes de marchandises", ["707"], "credit"),
  caseAmount("2033-B", "2033B_210", "Production vendue de biens", ["701", "702", "703", "704", "705"], "credit"),
  caseAmount("2033-B", "2033B_214", "Production vendue de services", ["706", "708"], "credit"),
  caseAmount("2033-B", "2033B_218", "Production stockée", ["713"], "credit"),
  caseAmount("2033-B", "2033B_222", "Production immobilisée", ["72"], "credit"),
  caseAmount("2033-B", "2033B_226", "Subventions d'exploitation", ["74"], "credit"),
  caseAmount("2033-B", "2033B_230", "Autres produits", ["75"], "credit"),
  caseAmount("2033-B", "2033B_234", "Achats de marchandises", ["607"], "debit"),
  caseAmount("2033-B", "2033B_238", "Variation de stock marchandises", ["6037"], "debit"),
  caseAmount("2033-B", "2033B_242", "Achats matières et autres approvisionnements", ["601", "602"], "debit"),
  caseAmount("2033-B", "2033B_244", "Variation de stock matières", ["6031", "6032"], "debit"),
  caseAmount("2033-B", "2033B_250", "Autres achats et charges externes", ["61", "62"], "debit"),
  caseAmount("2033-B", "2033B_254", "Impôts, taxes et versements assimilés", ["63"], "debit"),
  caseAmount("2033-B", "2033B_258", "Salaires et traitements", ["641"], "debit"),
  caseAmount("2033-B", "2033B_260", "Charges sociales", ["645"], "debit"),
  caseAmount("2033-B", "2033B_262", "Dotations aux amortissements", ["6811"], "debit"),
  caseAmount("2033-B", "2033B_264", "Dotations aux provisions", ["6815", "6817"], "debit"),
  caseAmount("2033-B", "2033B_290", "Produits financiers", ["76"], "credit"),
  caseAmount("2033-B", "2033B_294", "Charges financières", ["66"], "debit"),
  caseAmount("2033-B", "2033B_300", "Produits exceptionnels", ["77"], "credit"),
  caseAmount("2033-B", "2033B_304", "Charges exceptionnelles", ["67"], "debit"),
  caseAmount("2033-B", "2033B_310", "Impôts sur les bénéfices", ["695"], "debit"),
  caseAmount("2033-B", "2033B_312", "Résultat comptable", [], "credit", { requiredSource: "computed", formula: "classe_7 - classe_6" }),
  caseAmount("2033-C", "2033C_400", "Immobilisations incorporelles - acquisitions", ["20"], "debit"),
  caseAmount("2033-C", "2033C_410", "Immobilisations corporelles - acquisitions", ["21"], "debit"),
  caseAmount("2033-C", "2033C_420", "Immobilisations financières - acquisitions", ["26", "27"], "debit"),
  caseAmount("2033-C", "2033C_430", "Amortissements début d'exercice", ["28"], "credit"),
  caseAmount("2033-C", "2033C_440", "Dotations de l'exercice", ["6811"], "debit"),
  caseManual("2033-D", "2033D_500", "Plus-values à court terme"),
  caseManual("2033-D", "2033D_510", "Plus-values à long terme"),
  caseManual("2033-E", "2033E_600", "Effectif moyen du personnel", "amount"),
  caseManual("2033-E", "2033E_610", "Valeur ajoutée produite", "amount"),
  caseManual("2033-F", "2033F_700", "Composition du capital social", "text"),
  caseManual("2033-G", "2033G_800", "Filiales et participations", "text"),
] as const;

const TAX_PACKAGE_2050_CASES = [
  caseProfile("2050", "2050_001", "Dénomination de l'entreprise"),
  caseProfile("2050", "2050_002", "SIREN"),
  caseProfile("2050", "2050_003", "Adresse"),
  caseProfile("2050", "2050_004", "Date de début d'exercice", "date"),
  caseProfile("2050", "2050_005", "Date de fin d'exercice", "date"),
  caseAmount("2050", "2050_AA", "Capital souscrit non appelé", ["109"], "debit"),
  caseAmount("2050", "2050_AB", "Frais d'établissement", ["201"], "debit"),
  caseAmount("2050", "2050_CX", "Frais de recherche et développement", ["203"], "debit"),
  caseAmount("2050", "2050_AF", "Concessions, brevets et droits similaires", ["205"], "debit"),
  caseAmount("2050", "2050_AH", "Fonds commercial", ["207"], "debit"),
  caseAmount("2050", "2050_AJ", "Autres immobilisations incorporelles", ["208"], "debit"),
  caseAmount("2050", "2050_AL", "Avances et acomptes immobilisations incorporelles", ["237"], "debit"),
  caseAmount("2050", "2050_AN", "Terrains", ["211"], "debit"),
  caseAmount("2050", "2050_AP", "Constructions", ["213"], "debit"),
  caseAmount("2050", "2050_AR", "Installations techniques, matériel et outillage", ["215"], "debit"),
  caseAmount("2050", "2050_AT", "Autres immobilisations corporelles", ["218"], "debit"),
  caseAmount("2050", "2050_AV", "Immobilisations en cours", ["23"], "debit"),
  caseAmount("2050", "2050_AX", "Avances et acomptes immobilisations corporelles", ["238"], "debit"),
  caseAmount("2050", "2050_CS", "Participations", ["261"], "debit"),
  caseAmount("2050", "2050_CU", "Créances rattachées à participations", ["267"], "debit"),
  caseAmount("2050", "2050_BB", "Autres titres immobilisés", ["271", "272"], "debit"),
  caseAmount("2050", "2050_BD", "Prêts", ["274"], "debit"),
  caseAmount("2050", "2050_BF", "Autres immobilisations financières", ["275", "276"], "debit"),
  caseAmount("2050", "2050_BH", "Matières premières et approvisionnements", ["31", "32"], "debit"),
  caseAmount("2050", "2050_BJ", "En-cours de production de biens", ["33"], "debit"),
  caseAmount("2050", "2050_BL", "En-cours de production de services", ["34"], "debit"),
  caseAmount("2050", "2050_BN", "Produits intermédiaires et finis", ["35"], "debit"),
  caseAmount("2050", "2050_BP", "Marchandises", ["37"], "debit"),
  caseAmount("2050", "2050_BR", "Avances et acomptes versés", ["409"], "debit"),
  caseAmount("2050", "2050_BT", "Clients et comptes rattachés", ["41"], "debit"),
  caseAmount("2050", "2050_BV", "Autres créances", ["42", "43", "44", "45", "46", "47"], "debit"),
  caseAmount("2050", "2050_CD", "Valeurs mobilières de placement", ["50"], "debit"),
  caseAmount("2050", "2050_CF", "Disponibilités", ["51", "53"], "debit"),
  caseAmount("2050", "2050_CH", "Charges constatées d'avance", ["486"], "debit"),
  caseAmount("2051", "2051_DA", "Capital social ou individuel", ["101", "108"], "credit"),
  caseAmount("2051", "2051_DB", "Primes d'émission, de fusion, d'apport", ["104"], "credit"),
  caseAmount("2051", "2051_DC", "Écarts de réévaluation", ["105"], "credit"),
  caseAmount("2051", "2051_DD", "Réserve légale", ["1061"], "credit"),
  caseAmount("2051", "2051_DE", "Réserves statutaires ou contractuelles", ["1063"], "credit"),
  caseAmount("2051", "2051_DF", "Réserves réglementées", ["1064"], "credit"),
  caseAmount("2051", "2051_DG", "Autres réserves", ["1068"], "credit"),
  caseAmount("2051", "2051_DH", "Report à nouveau", ["11"], "credit"),
  caseAmount("2051", "2051_DI", "Résultat de l'exercice", ["12"], "credit"),
  caseAmount("2051", "2051_DJ", "Subventions d'investissement", ["13"], "credit"),
  caseAmount("2051", "2051_DK", "Provisions réglementées", ["14"], "credit"),
  caseAmount("2051", "2051_DL", "Provisions pour risques", ["151"], "credit"),
  caseAmount("2051", "2051_DM", "Provisions pour charges", ["15"], "credit"),
  caseAmount("2051", "2051_DS", "Emprunts obligataires convertibles", ["161"], "credit"),
  caseAmount("2051", "2051_DT", "Autres emprunts obligataires", ["163"], "credit"),
  caseAmount("2051", "2051_DU", "Emprunts et dettes auprès des établissements de crédit", ["164"], "credit"),
  caseAmount("2051", "2051_DV", "Emprunts et dettes financières divers", ["16", "17"], "credit"),
  caseAmount("2051", "2051_DW", "Avances et acomptes reçus", ["419"], "credit"),
  caseAmount("2051", "2051_DX", "Dettes fournisseurs et comptes rattachés", ["40"], "credit"),
  caseAmount("2051", "2051_DY", "Dettes fiscales et sociales", ["43", "44"], "credit"),
  caseAmount("2051", "2051_EA", "Autres dettes", ["45", "46", "47"], "credit"),
  caseAmount("2051", "2051_EB", "Produits constatés d'avance", ["487"], "credit"),
  caseAmount("2052", "2052_FA", "Ventes de marchandises France", ["707"], "credit"),
  caseAmount("2052", "2052_FD", "Production vendue biens France", ["701", "702", "703", "704", "705"], "credit"),
  caseAmount("2052", "2052_FG", "Production vendue services France", ["706", "708"], "credit"),
  caseAmount("2052", "2052_FL", "Chiffre d'affaires net", ["70"], "credit"),
  caseAmount("2052", "2052_FM", "Production stockée", ["713"], "credit"),
  caseAmount("2052", "2052_FN", "Production immobilisée", ["72"], "credit"),
  caseAmount("2052", "2052_FO", "Subventions d'exploitation", ["74"], "credit"),
  caseAmount("2052", "2052_FP", "Reprises sur amortissements et provisions", ["78"], "credit"),
  caseAmount("2052", "2052_FQ", "Autres produits", ["75"], "credit"),
  caseAmount("2052", "2052_FS", "Achats de marchandises", ["607"], "debit"),
  caseAmount("2052", "2052_FT", "Variation de stock marchandises", ["6037"], "debit"),
  caseAmount("2052", "2052_FU", "Achats matières premières", ["601", "602"], "debit"),
  caseAmount("2052", "2052_FV", "Variation de stock matières", ["6031", "6032"], "debit"),
  caseAmount("2052", "2052_FW", "Autres achats et charges externes", ["61", "62"], "debit"),
  caseAmount("2052", "2052_FX", "Impôts, taxes et versements assimilés", ["63"], "debit"),
  caseAmount("2052", "2052_FY", "Salaires et traitements", ["641"], "debit"),
  caseAmount("2052", "2052_FZ", "Charges sociales", ["645"], "debit"),
  caseAmount("2052", "2052_GA", "Dotations aux amortissements", ["6811"], "debit"),
  caseAmount("2052", "2052_GB", "Dotations aux provisions", ["6815", "6817"], "debit"),
  caseAmount("2052", "2052_GD", "Autres charges", ["65"], "debit"),
  caseAmount("2052", "2052_GG", "Produits financiers", ["76"], "credit"),
  caseAmount("2052", "2052_GR", "Charges financières", ["66"], "debit"),
  caseAmount("2053", "2053_HA", "Produits exceptionnels", ["77"], "credit"),
  caseAmount("2053", "2053_HE", "Charges exceptionnelles", ["67"], "debit"),
  caseAmount("2053", "2053_HK", "Impôts sur les bénéfices", ["695"], "debit"),
  caseAmount("2053", "2053_HN", "Bénéfice ou perte", [], "credit", { requiredSource: "computed", formula: "classe_7 - classe_6" }),
  caseAmount("2054", "2054_001", "Mouvements immobilisations incorporelles", ["20"], "debit"),
  caseAmount("2054", "2054_002", "Mouvements immobilisations corporelles", ["21", "23"], "debit"),
  caseAmount("2054", "2054_003", "Mouvements immobilisations financières", ["26", "27"], "debit"),
  caseAmount("2055", "2055_010", "Amortissements incorporels", ["280"], "credit"),
  caseAmount("2055", "2055_020", "Amortissements corporels", ["281"], "credit"),
  caseAmount("2056", "2056_010", "Provisions réglementées", ["14"], "credit"),
  caseAmount("2056", "2056_020", "Provisions pour risques et charges", ["15"], "credit"),
  caseManual("2057", "2057_010", "Échéances des créances", "amount"),
  caseManual("2057", "2057_020", "Échéances des dettes", "amount"),
  caseManual("2058-A", "2058A_010", "Réintégrations fiscales", "amount"),
  caseManual("2058-A", "2058A_020", "Déductions fiscales", "amount"),
  caseManual("2058-B", "2058B_010", "Déficits reportables", "amount"),
  caseManual("2058-C", "2058C_010", "Affectation du résultat", "amount"),
] as const;

export const TAX_PACKAGE_2033_REFERENCE_PAYLOAD = {
  packageCode: "2033-SD",
  label: "Pré-liasse réel simplifié 2033",
  tables: TAX_PACKAGE_2033_TABLES,
  cases: TAX_PACKAGE_2033_CASES,
  formulas: [
    { code: "resultat", label: "Résultat comptable", expression: "classe_7 - classe_6" },
    { code: "total_actif", label: "Total actif", expression: "immobilisations_nettes + stocks + creances + disponibilites" },
  ],
  sourceUrl: OFFICIAL_SOURCES.impotsTax2033,
  outputLabel: "préparation vérifiable",
} as const;

export const TAX_PACKAGE_2050_REFERENCE_PAYLOAD = {
  packageCode: "2050-LIASSE",
  label: "Pré-liasse réel normal 2050",
  tables: TAX_PACKAGE_2050_TABLES,
  cases: TAX_PACKAGE_2050_CASES,
  formulas: [
    { code: "resultat", label: "Résultat comptable", expression: "classe_7 - classe_6" },
    { code: "total_bilan", label: "Contrôle total bilan", expression: "total_actif = total_passif" },
  ],
  sourceUrl: OFFICIAL_SOURCES.impotsTax2050,
  outputLabel: "préparation vérifiable",
} as const;

export const CLOSING_ADJUSTMENT_REFERENCE_PAYLOAD = {
  accountRoles: {
    prepaidExpense: "486",
    deferredIncome: "487",
    accruedExpenseSupplier: "4081",
    accruedRevenueCustomer: "4181",
    provision: "151",
    provisionExpense: "6815",
    corporateTaxExpense: "695",
    corporateTaxPayable: "444",
    loanInterestExpense: "6611",
    accruedLoanInterest: "1688",
    payrollExpense: "641",
    payrollPayable: "428",
    stockVariation: "6037",
    suspense: "471",
    bank: "5121",
    reconciliationExpense: "658",
    reconciliationIncome: "758",
  },
  types: [
    { kind: "PREPAID_EXPENSE", label: "Charge constatée d'avance", accounts: ["486", "616"], evidence: "recommended", formula: "part_exercice_suivant" },
    { kind: "DEFERRED_INCOME", label: "Produit constaté d'avance", accounts: ["487", "706"], evidence: "recommended", formula: "part_exercice_suivant" },
    { kind: "ACCRUED_EXPENSE", label: "Facture non parvenue", accounts: ["4081", "6"], evidence: "blocking", formula: "montant_estime_justifie" },
    { kind: "ACCRUED_REVENUE", label: "Facture à établir", accounts: ["4181", "7"], evidence: "blocking", formula: "montant_estime_justifie" },
    { kind: "PROVISION", label: "Provision", accounts: ["15", "6815"], evidence: "blocking", formula: "risque_documente" },
    { kind: "VAT_SETTLEMENT", label: "Régularisation TVA", accounts: ["44551", "44567", "44571", "44566"], evidence: "recommended", formula: "solde_tva" },
    { kind: "CORPORATE_TAX", label: "Impôt sur les sociétés", accounts: ["444", "695"], evidence: "recommended", formula: "resultat_fiscal" },
    { kind: "RECONCILIATION_DIFFERENCE", label: "Écart de rapprochement", accounts: ["471", "512"], evidence: "blocking", formula: "ecart_identifie" },
  ],
  validation: ["pcg_accounts_known", "balanced_entry", "blocking_evidence_before_approval", "user_approval_required"],
} as const;

export const FIXED_ASSET_REFERENCE_PAYLOAD = {
  accountRoles: {
    defaultAsset: "2183",
    defaultAmortization: "2818",
    defaultExpense: "68112",
  },
  families: [
    { key: "software", label: "Logiciels", assetAccount: "205", amortizationAccount: "2805", expenseAccount: "68112", usefulLifeYears: 3, method: "linear" },
    { key: "equipment", label: "Matériel", assetAccount: "215", amortizationAccount: "2815", expenseAccount: "68112", usefulLifeYears: 5, method: "linear" },
    { key: "office_it", label: "Matériel informatique", assetAccount: "2183", amortizationAccount: "2818", expenseAccount: "68112", usefulLifeYears: 3, method: "linear" },
    { key: "furniture", label: "Mobilier", assetAccount: "2184", amortizationAccount: "2818", expenseAccount: "68112", usefulLifeYears: 10, method: "linear" },
    { key: "vehicle", label: "Véhicules", assetAccount: "2182", amortizationAccount: "2818", expenseAccount: "68112", usefulLifeYears: 5, method: "linear" },
  ],
  methods: ["linear"],
  controls: ["pcg_accounts_known", "positive_useful_life", "prorata_temporis", "user_duration_override_audited"],
} as const;

export const EVIDENCE_REFERENCE_PAYLOAD = {
  requirementLevels: ["blocking", "to_complete", "recommended"],
  byEntrySource: [
    { source: "IMPORT", label: "Écriture issue d'import", level: "to_complete", compatibleEvidence: ["invoice", "receipt", "bank_statement"] },
    { source: "MANUAL", label: "Écriture manuelle", level: "to_complete", compatibleEvidence: ["invoice", "receipt", "contract", "work_note"] },
    { source: "CLOSING_ADJUSTMENT", label: "OD de clôture", level: "blocking_when_required_by_adjustment", compatibleEvidence: ["invoice", "contract", "calculation_note"] },
    { source: "E_INVOICE", label: "Facture électronique", level: "strong_when_pa_received", compatibleEvidence: ["xml", "pdf", "pa_receipt"] },
  ],
  wording: {
    nonBlockingGap: "écriture sans justificatif rattaché",
    orphanEvidence: "pièce sans écriture",
    reviewNeeded: "pièce à relire",
  },
} as const;

export const RECONCILIATION_REFERENCE_PAYLOAD = {
  accountRoles: {
    bank: "5121",
    bankFec: "5121",
    suspense: "471",
    paymentInTransit: "511",
    supplier: "401",
    customer: "411",
    otherThirdParty: "467",
  },
  accounts: {
    bankPrefixes: ["512"],
    thirdPartyPrefixes: ["401", "411", "467"],
    suspensePrefixes: ["471"],
  },
  tolerances: {
    exactAmountEpsilon: 0.01,
    dateDays: 3,
    autoMatchRequiresExactAmount: true,
    autoMatchRequiresSingleCandidate: true,
  },
  reviewRules: ["amount_difference", "multiple_candidates", "date_outside_tolerance", "persistent_gap"],
} as const;

export const E_INVOICE_REFERENCE_PAYLOAD = {
  accountRoles: {
    supplier: "401",
    purchaseNeedsReview: "471",
  },
  formats: [
    { key: "FACTUR_X", label: "Factur-X", requiredPayloads: ["pdf", "xml"] },
    { key: "UBL", label: "UBL", requiredPayloads: ["xml"] },
    { key: "CII", label: "CII", requiredPayloads: ["xml"] },
  ],
  requiredFields: ["supplierName", "invoiceNumber", "issueDate", "currency", "totalHt", "totalVat", "totalTtc"],
  providerStatuses: ["received", "available", "read", "matched", "accounted", "rejected", "cancelled", "error"],
  dedupeKeys: ["providerInvoiceId", "checksum", "supplierInvoiceNumber"],
  compliantReceptionRequires: ["accredited_platform_adapter", "source_xml", "reception_proof", "provider_timestamp"],
  manualUploadLabel: "Upload manuel exploitable, non équivalent à une réception PA conforme",
} as const;

export const RETENTION_REFERENCE_PAYLOAD = {
  purgeable: [
    { kind: "share_link", retentionDays: 30, condition: "expiré ou révoqué" },
    { kind: "notification", retentionDays: 365, condition: "résolue" },
    { kind: "webhook_event", retentionDays: 90, condition: "ancien et traité" },
    { kind: "privacy_export", retentionDays: 7, condition: "archive temporaire" },
    { kind: "temporary_workdir", retentionDays: 1, condition: "fichier runtime temporaire" },
  ],
  protectedAccountingData: [
    "écritures comptables",
    "FEC",
    "documents comptables",
    "justificatifs",
    "preuves de clôture",
    "dossier expert-comptable final",
  ],
} as const;

export function buildOfficialReferencePacks(): Record<OfficialReferenceKind, OfficialReferencePack> {
  const chart = new ChartOfAccountsCenter().getSourceMetadata();
  const chartValidation = new ChartOfAccountsCenter().validateChartIntegrity();

  return {
    chart_of_accounts: {
      kind: "chart_of_accounts",
      version: chart.sourceVersion,
      status: chartValidation.ok ? "ACTIVE" : "BLOCKED",
      source: "ANC",
      sourceUrl: chart.sourceDocumentUrl,
      checksum: chart.sourceChecksum,
      retrievedAt: CHECKED_AT,
      publishedAt: "2026-01-01",
      effectiveFrom: chart.effectiveFrom,
      summary: "Plan comptable général ANC chargé comme référentiel structuré Qitus.",
      payloadJson: { accountCount: chartValidation.accountCount, version: chart.sourceVersion },
      validationJson: validation(chartValidation.ok, [], chartValidation.missingCriticalAccounts.map((account) => `Compte critique ${account} absent du PCG actif.`), []),
    },
    vat: pack("vat", "VAT-FR-2026-2", "IMPOTS_GOUV", OFFICIAL_SOURCES.impotsVatCa3, VAT_REFERENCE_PAYLOAD, "Règles TVA CA3/CA12, taux, natures et comptes 445xx.", extractAccounts(VAT_REFERENCE_PAYLOAD)),
    fec: pack("fec", "FEC-FR-2026", "BOFIP", OFFICIAL_SOURCES.bofipFec, FEC_REFERENCE_PAYLOAD, "Colonnes, ordre, format et contrôles FEC.", []),
    tax_package_2033: pack("tax_package_2033", "2033-SD-2026-CERFA-2", "IMPOTS_GOUV", OFFICIAL_SOURCES.impotsTax2033, TAX_PACKAGE_2033_REFERENCE_PAYLOAD, "Pré-liasse réel simplifié 2033, CERFA complet case par case.", extractAccounts(TAX_PACKAGE_2033_REFERENCE_PAYLOAD)),
    tax_package_2050: pack("tax_package_2050", "2050-LIASSE-2026-CERFA-2", "IMPOTS_GOUV", OFFICIAL_SOURCES.impotsTax2050, TAX_PACKAGE_2050_REFERENCE_PAYLOAD, "Pré-liasse réel normal 2050, CERFA complet case par case.", extractAccounts(TAX_PACKAGE_2050_REFERENCE_PAYLOAD)),
    closing_adjustments: pack("closing_adjustments", "OD-CLOTURE-FR-2026-2", "INTERNAL_QITUS", OFFICIAL_SOURCES.ancPcg, CLOSING_ADJUSTMENT_REFERENCE_PAYLOAD, "Types d'OD, comptes, preuves et règles de validation.", extractAccounts(CLOSING_ADJUSTMENT_REFERENCE_PAYLOAD)),
    fixed_assets: pack("fixed_assets", "IMMOBILISATIONS-FR-2026-2", "INTERNAL_QITUS", OFFICIAL_SOURCES.ancPcg, FIXED_ASSET_REFERENCE_PAYLOAD, "Familles d'immobilisations, comptes et durées usuelles indicatives.", extractAccounts(FIXED_ASSET_REFERENCE_PAYLOAD)),
    evidence: pack("evidence", "JUSTIFICATIFS-QITUS-2026", "INTERNAL_QITUS", OFFICIAL_SOURCES.bofipFec, EVIDENCE_REFERENCE_PAYLOAD, "Règles de justificatifs bloquants, à compléter et recommandés.", []),
    reconciliation: pack("reconciliation", "RAPPROCHEMENTS-QITUS-2026-2", "INTERNAL_QITUS", OFFICIAL_SOURCES.ancPcg, RECONCILIATION_REFERENCE_PAYLOAD, "Comptes, tolérances et conditions de revue des rapprochements.", extractAccounts(RECONCILIATION_REFERENCE_PAYLOAD)),
    e_invoice: pack("e_invoice", "FACTURE-ELECTRONIQUE-FR-2026-2", "IMPOTS_GOUV", OFFICIAL_SOURCES.impotsEInvoice, E_INVOICE_REFERENCE_PAYLOAD, "Formats, statuts et preuves de réception des factures électroniques entrantes.", extractAccounts(E_INVOICE_REFERENCE_PAYLOAD)),
    retention: pack("retention", "CONSERVATION-RGPD-QITUS-2026", "INTERNAL_QITUS", "https://www.cnil.fr/fr/rgpd-de-quoi-parle-t-on", RETENTION_REFERENCE_PAYLOAD, "Conservation, purge et protection des données comptables.", []),
  };
}

function pack<TPayload>(
  kind: OfficialReferenceKind,
  version: string,
  source: OfficialReferenceSource,
  sourceUrl: string,
  payloadJson: TPayload,
  summary: string,
  accountCodes: string[],
): OfficialReferencePack<TPayload> {
  const checksum = officialReferenceChecksum({ kind, version, source, sourceUrl, payloadJson });
  const accountValidation = validatePcgAccounts(accountCodes);
  return {
    kind,
    version,
    status: accountValidation.errors.length === 0 ? "ACTIVE" : "BLOCKED",
    source,
    sourceUrl,
    checksum,
    retrievedAt: CHECKED_AT,
    publishedAt: "2026-01-01",
    effectiveFrom: "2026-01-01",
    summary,
    payloadJson,
    validationJson: validation(accountValidation.errors.length === 0, accountValidation.warnings, accountValidation.errors, accountCodes),
  };
}

function validation(ok: boolean, warnings: string[], errors: string[], accountCodes: string[]): OfficialReferenceValidation {
  return { ok, warnings, errors, accountCodes: Array.from(new Set(accountCodes)).sort(), checkedAt: CHECKED_AT };
}

function extractAccounts(value: unknown): string[] {
  const accounts = new Set<string>();
  const walk = (node: unknown, accountContext = false) => {
    if (Array.isArray(node)) {
      node.forEach((item) => walk(item, accountContext));
      return;
    }
    if (!node || typeof node !== "object") {
      if (accountContext && typeof node === "string" && /^[1-9][0-9]{1,7}$/.test(node)) accounts.add(node);
      return;
    }
    Object.entries(node as Record<string, unknown>).forEach(([key, nested]) => {
      const nextIsAccount = /account/i.test(key) || /compte/i.test(key) || key === "accounts";
      if (nextIsAccount || (nested && typeof nested === "object")) walk(nested, nextIsAccount);
    });
  };
  walk(value);
  return Array.from(accounts);
}

function validatePcgAccounts(accountCodes: string[]) {
  const chart = new ChartOfAccountsCenter();
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const account of Array.from(new Set(accountCodes))) {
    if (!chart.isKnownAccount(account)) {
      if (/^[1-9]$/.test(account) || /^[1-9][0-9]$/.test(account)) warnings.push(`Compte racine ${account} utilisé comme préfixe.`);
      else errors.push(`Compte ${account} absent du PCG actif.`);
    }
  }
  return { errors, warnings };
}

export function isOfficialReferenceKind(value: string | undefined): value is OfficialReferenceKind {
  return OFFICIAL_REFERENCE_KINDS.includes(value as OfficialReferenceKind);
}

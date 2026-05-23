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
export type TaxPackageReferencePayload = typeof TAX_PACKAGE_2033_REFERENCE_PAYLOAD;
export type ClosingAdjustmentReferencePayload = typeof CLOSING_ADJUSTMENT_REFERENCE_PAYLOAD;
export type FixedAssetReferencePayload = typeof FIXED_ASSET_REFERENCE_PAYLOAD;
export type EvidenceReferencePayload = typeof EVIDENCE_REFERENCE_PAYLOAD;
export type ReconciliationReferencePayload = typeof RECONCILIATION_REFERENCE_PAYLOAD;
export type EInvoiceReferencePayload = typeof E_INVOICE_REFERENCE_PAYLOAD;
export type DataRetentionReferencePayload = typeof RETENTION_REFERENCE_PAYLOAD;

export const VAT_REFERENCE_PAYLOAD = {
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

const COMMON_TAX_CASES = [
  { code: "capital", label: "Capital social", accountPrefixes: ["101"], type: "amount", requiredSource: "journal" },
  { code: "immobilisations_brutes", label: "Immobilisations brutes", accountPrefixes: ["20", "21"], type: "amount", requiredSource: "journal" },
  { code: "amortissements", label: "Amortissements", accountPrefixes: ["28"], type: "amount", requiredSource: "journal" },
  { code: "stocks", label: "Stocks", accountPrefixes: ["3"], type: "amount", requiredSource: "journal" },
  { code: "creances", label: "Créances", accountPrefixes: ["41"], type: "amount", requiredSource: "journal" },
  { code: "disponibilites", label: "Disponibilités", accountPrefixes: ["51", "53"], type: "amount", requiredSource: "journal" },
  { code: "capitaux_propres", label: "Capitaux propres", accountPrefixes: ["10", "11", "12"], type: "amount", requiredSource: "journal" },
  { code: "dettes_fournisseurs", label: "Dettes fournisseurs", accountPrefixes: ["40"], type: "amount", requiredSource: "journal" },
  { code: "chiffre_affaires", label: "Chiffre d'affaires", accountPrefixes: ["70"], type: "amount", requiredSource: "journal" },
  { code: "achats", label: "Achats", accountPrefixes: ["60"], type: "amount", requiredSource: "journal" },
  { code: "charges_externes", label: "Charges externes", accountPrefixes: ["61", "62"], type: "amount", requiredSource: "journal" },
  { code: "impots_taxes", label: "Impôts et taxes", accountPrefixes: ["63"], type: "amount", requiredSource: "journal" },
  { code: "charges_personnel", label: "Charges de personnel", accountPrefixes: ["64"], type: "amount", requiredSource: "journal" },
  { code: "dotations", label: "Dotations", accountPrefixes: ["68"], type: "amount", requiredSource: "journal" },
] as const;

export const TAX_PACKAGE_2033_REFERENCE_PAYLOAD = {
  packageCode: "2033-SD",
  label: "Pré-liasse réel simplifié 2033",
  tables: ["2033-A", "2033-B", "2033-C", "2033-D", "2033-E", "2033-F", "2033-G"],
  cases: COMMON_TAX_CASES,
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
  tables: ["2050", "2051", "2052", "2053", "2054", "2055", "2056", "2057", "2058-A", "2058-B", "2058-C"],
  cases: COMMON_TAX_CASES,
  formulas: [
    { code: "resultat", label: "Résultat comptable", expression: "classe_7 - classe_6" },
    { code: "total_bilan", label: "Contrôle total bilan", expression: "total_actif = total_passif" },
  ],
  sourceUrl: OFFICIAL_SOURCES.impotsTax2050,
  outputLabel: "préparation vérifiable",
} as const;

export const CLOSING_ADJUSTMENT_REFERENCE_PAYLOAD = {
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
    vat: pack("vat", "VAT-FR-2026", "IMPOTS_GOUV", OFFICIAL_SOURCES.impotsVatCa3, VAT_REFERENCE_PAYLOAD, "Règles TVA CA3/CA12, taux, natures et comptes 445xx.", extractAccounts(VAT_REFERENCE_PAYLOAD)),
    fec: pack("fec", "FEC-FR-2026", "BOFIP", OFFICIAL_SOURCES.bofipFec, FEC_REFERENCE_PAYLOAD, "Colonnes, ordre, format et contrôles FEC.", []),
    tax_package_2033: pack("tax_package_2033", "2033-SD-2026", "IMPOTS_GOUV", OFFICIAL_SOURCES.impotsTax2033, TAX_PACKAGE_2033_REFERENCE_PAYLOAD, "Pré-liasse réel simplifié 2033, cases et contrôles.", extractAccounts(TAX_PACKAGE_2033_REFERENCE_PAYLOAD)),
    tax_package_2050: pack("tax_package_2050", "2050-LIASSE-2026", "IMPOTS_GOUV", OFFICIAL_SOURCES.impotsTax2050, TAX_PACKAGE_2050_REFERENCE_PAYLOAD, "Pré-liasse réel normal 2050, cases et contrôles.", extractAccounts(TAX_PACKAGE_2050_REFERENCE_PAYLOAD)),
    closing_adjustments: pack("closing_adjustments", "OD-CLOTURE-FR-2026", "INTERNAL_QITUS", OFFICIAL_SOURCES.ancPcg, CLOSING_ADJUSTMENT_REFERENCE_PAYLOAD, "Types d'OD, comptes, preuves et règles de validation.", extractAccounts(CLOSING_ADJUSTMENT_REFERENCE_PAYLOAD)),
    fixed_assets: pack("fixed_assets", "IMMOBILISATIONS-FR-2026", "INTERNAL_QITUS", OFFICIAL_SOURCES.ancPcg, FIXED_ASSET_REFERENCE_PAYLOAD, "Familles d'immobilisations, comptes et durées usuelles indicatives.", extractAccounts(FIXED_ASSET_REFERENCE_PAYLOAD)),
    evidence: pack("evidence", "JUSTIFICATIFS-QITUS-2026", "INTERNAL_QITUS", OFFICIAL_SOURCES.bofipFec, EVIDENCE_REFERENCE_PAYLOAD, "Règles de justificatifs bloquants, à compléter et recommandés.", []),
    reconciliation: pack("reconciliation", "RAPPROCHEMENTS-QITUS-2026", "INTERNAL_QITUS", OFFICIAL_SOURCES.ancPcg, RECONCILIATION_REFERENCE_PAYLOAD, "Comptes, tolérances et conditions de revue des rapprochements.", extractAccounts(RECONCILIATION_REFERENCE_PAYLOAD)),
    e_invoice: pack("e_invoice", "FACTURE-ELECTRONIQUE-FR-2026", "IMPOTS_GOUV", OFFICIAL_SOURCES.impotsEInvoice, E_INVOICE_REFERENCE_PAYLOAD, "Formats, statuts et preuves de réception des factures électroniques entrantes.", []),
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

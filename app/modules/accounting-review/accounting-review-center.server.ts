import { type AccountingIssueStatus, type Company, type DocumentType, type FiscalYear } from "@prisma/client";
import { prisma } from "../db.server";
import { ExpectedRouteError } from "../route-errors.server";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { isTransactionInReview } from "../transactions/transaction-review-state";
import { ReconciliationIssueWorkflow } from "../reconciliations/reconciliation-issue-workflow.server";

export type AccountingReviewStatus = "blocked" | "ready_with_warnings" | "ready";
export type AccountingControlSeverity = "blocking" | "warning";
export type AccountingControlCategory =
  | "transactions"
  | "ledger"
  | "documents"
  | "pre_closing"
  | "tax"
  | "reconciliation";

export type AccountingControlAction = {
  label: string;
  href: string;
};

export type AccountingControlEvidence = {
  issueKey?: string;
  entityType?: string;
  entityId?: string;
  label?: string;
  amount?: string;
  account?: string;
  date?: string;
  resolutionStatus?: AccountingIssueStatus;
  note?: string | null;
};

export type AccountingControl = {
  code: string;
  severity: AccountingControlSeverity;
  category: AccountingControlCategory;
  title: string;
  detail: string;
  action: AccountingControlAction;
  evidence: AccountingControlEvidence[];
  openIssueCount: number;
  handledIssueCount: number;
};

export type AccountingReview = {
  status: AccountingReviewStatus;
  blockingCount: number;
  warningCount: number;
  controls: AccountingControl[];
  generatedAt: string;
};

export type AccountingReviewScope = {
  company: Company;
  fiscalYear: FiscalYear;
};

export type AccountingReviewSnapshot = {
  company: Pick<Company, "vatRegime">;
  documents: Array<{ type: DocumentType; generatedAt: Date }>;
  latestAccountingChangeAt: Date | null;
  transactionsInReview: AccountingControlEvidence[];
  confirmedTransactionsWithoutEntry: AccountingControlEvidence[];
  annualChargeCandidates: AccountingControlEvidence[];
  fixedAssetCandidates: AccountingControlEvidence[];
  stripeCandidates: AccountingControlEvidence[];
  reconciliationIssues?: AccountingControlEvidence[];
  revenue: number;
  hasBankEntries: boolean;
  fiscalYearId?: string;
  issueResolutions?: AccountingIssueResolutionState[];
};

export type AccountingIssueResolutionState = {
  issueKey: string;
  controlCode: string;
  status: AccountingIssueStatus;
  note: string | null;
};

const FRANCHISE_VAT_SERVICE_THRESHOLD = 36_800;
const VAT_WARNING_RATIO = 0.8;

export class DocumentGenerationBlockedError extends ExpectedRouteError {
  constructor(readonly review: AccountingReview) {
    super(blockedDocumentMessage(review.blockingCount), 409);
  }
}

export class AccountingReviewCenter {
  async getReview(scope: CompanyWorkspace | AccountingReviewScope): Promise<AccountingReview> {
    const snapshot = await loadReviewSnapshot(scope.company, scope.fiscalYear);
    return buildAccountingReview(snapshot);
  }

  async listDetectedControls(scope: CompanyWorkspace | AccountingReviewScope): Promise<AccountingControl[]> {
    const snapshot = await loadReviewSnapshot(scope.company, scope.fiscalYear);
    return buildAccountingReview(snapshot, { includeHandledIssues: true }).controls;
  }

  async listControls(scope: CompanyWorkspace | AccountingReviewScope): Promise<AccountingControl[]> {
    return (await this.getReview(scope)).controls;
  }

  async assertDocumentsCanBeGenerated(scope: CompanyWorkspace | AccountingReviewScope, _documentType: "fec" | "statements") {
    const review = await this.getReview(scope);
    assertReviewAllowsDocumentGeneration(review);
    return review;
  }
}

export function assertReviewAllowsDocumentGeneration(review: AccountingReview) {
  if (review.blockingCount > 0) throw new DocumentGenerationBlockedError(review);
}

export function buildAccountingReview(
  snapshot: AccountingReviewSnapshot,
  options: { includeHandledIssues?: boolean } = {}
): AccountingReview {
  const rawControls: AccountingControl[] = [
    ...transactionReviewControls(snapshot),
    ...ledgerCompletenessControls(snapshot),
    ...documentControls(snapshot),
    ...preClosingControls(snapshot),
    ...taxControls(snapshot),
    ...reconciliationControls(snapshot),
  ].map((control) => applyResolutionState(control, snapshot.issueResolutions ?? []));
  const controls: AccountingControl[] = [
    ...rawControls.flatMap((control) => filterControlByIssueState(control, options)),
  ];
  const blockingCount = controls.filter((control) => control.severity === "blocking").length;
  const warningCount = controls.filter((control) => control.severity === "warning").length;
  return {
    status: blockingCount > 0 ? "blocked" : warningCount > 0 ? "ready_with_warnings" : "ready",
    blockingCount,
    warningCount,
    controls,
    generatedAt: new Date().toISOString(),
  };
}

async function loadReviewSnapshot(company: Company, fiscalYear: FiscalYear): Promise<AccountingReviewSnapshot> {
  const [transactions, documents, entries, lines, issueResolutions, reconciliationQueue] = await Promise.all([
    prisma.transaction.findMany({
      where: { fiscalYearId: fiscalYear.id },
      include: { categorization: true },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    }),
    prisma.document.findMany({
      where: { fiscalYearId: fiscalYear.id, status: "READY" },
      select: { type: true, generatedAt: true },
    }),
    prisma.journalEntry.findMany({
      where: { fiscalYearId: fiscalYear.id },
      select: { updatedAt: true, createdAt: true },
    }),
    prisma.journalLine.findMany({
      where: { journalEntry: { fiscalYearId: fiscalYear.id } },
      select: { account: true, debit: true, credit: true },
    }),
    prisma.accountingIssueResolution.findMany({
      where: { fiscalYearId: fiscalYear.id },
      select: { issueKey: true, controlCode: true, status: true, note: true },
    }),
    new ReconciliationIssueWorkflow().getReviewQueue({ company, fiscalYear } as CompanyWorkspace, { status: "OPEN" }).catch(() => ({ issues: [] })),
  ]);

  const latestAccountingChangeAt = latestDate([
    ...transactions.map((transaction) => transaction.updatedAt),
    ...entries.map((entry) => entry.updatedAt ?? entry.createdAt),
  ]);

  return {
    company,
    documents,
    latestAccountingChangeAt,
    transactionsInReview: transactions
      .filter((transaction) => isTransactionInReview(transaction.categorization))
      .map((transaction) => transactionEvidence(transaction, displayAccount(transaction.amount.toNumber(), transaction.categorization))),
    confirmedTransactionsWithoutEntry: transactions
      .filter((transaction) => !isTransactionInReview(transaction.categorization) && !transaction.journalEntryId)
      .map((transaction) => transactionEvidence(transaction, displayAccount(transaction.amount.toNumber(), transaction.categorization))),
    annualChargeCandidates: transactions
      .filter((transaction) => isAnnualChargeCandidate(transaction))
      .map((transaction) => transactionEvidence(transaction, displayAccount(transaction.amount.toNumber(), transaction.categorization), "ANNUAL_CHARGE_CCA")),
    fixedAssetCandidates: transactions
      .filter((transaction) => isFixedAssetCandidate(transaction))
      .map((transaction) => transactionEvidence(transaction, displayAccount(transaction.amount.toNumber(), transaction.categorization), "FIXED_ASSET_CANDIDATE")),
    stripeCandidates: transactions
      .filter((transaction) => isStripeReconciliationCandidate(transaction))
      .map((transaction) => transactionEvidence(transaction, displayAccount(transaction.amount.toNumber(), transaction.categorization), "STRIPE_RECONCILIATION")),
    reconciliationIssues: reconciliationQueue.issues.map((issue) => ({
      issueKey: issue.issueKey,
      entityType: issue.entityType,
      entityId: issue.entityId,
      label: issue.note ?? issue.code,
      account: accountFromIssueKey(issue.issueKey),
    })),
    revenue: lines.reduce((total, line) => line.account.startsWith("70") ? total + Number(line.credit) - Number(line.debit) : total, 0),
    hasBankEntries: lines.some((line) => line.account.startsWith("512")),
    fiscalYearId: fiscalYear.id,
    issueResolutions,
  };
}

function transactionReviewControls(snapshot: AccountingReviewSnapshot): AccountingControl[] {
  if (snapshot.transactionsInReview.length === 0) return [];
  return [{
    code: "UNCORRECTED_TRANSACTIONS",
    severity: "blocking",
    category: "transactions",
    title: `${snapshot.transactionsInReview.length} transaction${snapshot.transactionsInReview.length > 1 ? "s" : ""} à corriger`,
    detail: "Les documents comptables restent bloqués tant que des transactions sont en compte d'attente ou en revue.",
    action: { label: "Corriger les transactions", href: "/transactions" },
    evidence: snapshot.transactionsInReview.slice(0, 5),
    openIssueCount: 0,
    handledIssueCount: 0,
  }];
}

function ledgerCompletenessControls(snapshot: AccountingReviewSnapshot): AccountingControl[] {
  if (snapshot.confirmedTransactionsWithoutEntry.length === 0) return [];
  return [{
    code: "MISSING_JOURNAL_ENTRIES",
    severity: "blocking",
    category: "ledger",
    title: `${snapshot.confirmedTransactionsWithoutEntry.length} écriture${snapshot.confirmedTransactionsWithoutEntry.length > 1 ? "s" : ""} manquante${snapshot.confirmedTransactionsWithoutEntry.length > 1 ? "s" : ""}`,
    detail: "Certaines transactions confirmées n'ont pas encore d'écriture équilibrée.",
    action: { label: "Voir les écritures", href: "/ecritures" },
    evidence: snapshot.confirmedTransactionsWithoutEntry.slice(0, 5),
    openIssueCount: 0,
    handledIssueCount: 0,
  }];
}

function documentControls(snapshot: AccountingReviewSnapshot): AccountingControl[] {
  const controls: AccountingControl[] = [];
  const documentTypes = snapshot.documents.map((document) => document.type);
  if (!documentTypes.includes("FEC")) {
    controls.push({
      code: "MISSING_FEC",
      severity: "warning",
      category: "documents",
      title: "FEC non généré",
      detail: "Le fichier des écritures comptables n'a pas encore été produit pour cet exercice.",
      action: { label: "Générer les documents", href: "/documents" },
      evidence: [],
      openIssueCount: 0,
      handledIssueCount: 0,
    });
  }
  const statementsReady = ["BALANCE", "BILAN", "COMPTE_RESULTAT"].every((type) => documentTypes.includes(type as DocumentType));
  if (!statementsReady) {
    controls.push({
      code: "MISSING_STATEMENTS",
      severity: "warning",
      category: "documents",
      title: "États financiers non générés",
      detail: "La balance, le bilan et le compte de résultat ne sont pas encore disponibles.",
      action: { label: "Générer les états", href: "/documents" },
      evidence: [],
      openIssueCount: 0,
      handledIssueCount: 0,
    });
  }
  if (snapshot.latestAccountingChangeAt && snapshot.documents.some((document) => document.generatedAt < snapshot.latestAccountingChangeAt!)) {
    controls.push({
      code: "DOCUMENTS_OUTDATED",
      severity: "warning",
      category: "documents",
      title: "Documents à régénérer",
      detail: "Des écritures ou corrections sont plus récentes que les documents générés.",
      action: { label: "Régénérer", href: "/documents" },
      evidence: [],
      openIssueCount: 0,
      handledIssueCount: 0,
    });
  }
  return controls;
}

function preClosingControls(snapshot: AccountingReviewSnapshot): AccountingControl[] {
  const controls: AccountingControl[] = [];
  if (snapshot.annualChargeCandidates.length > 0) {
    controls.push({
      code: "ANNUAL_CHARGE_CCA",
      severity: "warning",
      category: "pre_closing",
      title: "Charges annuelles à revoir en CCA",
      detail: "Certaines charges annuelles peuvent couvrir une période hors exercice et nécessiter une charge constatée d'avance.",
      action: { label: "Traiter les CCA", href: "/controle/ANNUAL_CHARGE_CCA" },
      evidence: snapshot.annualChargeCandidates,
      openIssueCount: 0,
      handledIssueCount: 0,
    });
  }
  if (snapshot.fixedAssetCandidates.length > 0) {
    controls.push({
      code: "FIXED_ASSET_CANDIDATE",
      severity: "warning",
      category: "pre_closing",
      title: "Immobilisations à amortir",
      detail: "Des achats comptabilisés en comptes de classe 2 doivent être revus avant clôture.",
      action: { label: "Traiter les immobilisations", href: "/controle/FIXED_ASSET_CANDIDATE" },
      evidence: snapshot.fixedAssetCandidates,
      openIssueCount: 0,
      handledIssueCount: 0,
    });
  }
  return controls;
}

function taxControls(snapshot: AccountingReviewSnapshot): AccountingControl[] {
  if (snapshot.company.vatRegime !== "FRANCHISE") return [];
  const threshold = FRANCHISE_VAT_SERVICE_THRESHOLD;
  if (snapshot.revenue < threshold * VAT_WARNING_RATIO) return [];
  return [{
    code: "VAT_THRESHOLD",
    severity: "warning",
    category: "tax",
    title: "Seuil TVA franchise à surveiller",
    detail: `Le chiffre d'affaires comptabilisé approche le seuil indicatif de ${formatEuro(threshold)}.`,
    action: { label: "Traiter le seuil TVA", href: "/controle/VAT_THRESHOLD" },
    evidence: [{
      issueKey: issueKey("VAT_THRESHOLD", "fiscal-year", snapshot.fiscalYearId ?? "current"),
      entityType: "fiscal-year",
      entityId: snapshot.fiscalYearId,
      label: "Chiffre d'affaires comptabilisé",
      amount: snapshot.revenue.toFixed(2),
      account: "70",
    }],
    openIssueCount: 0,
    handledIssueCount: 0,
  }];
}

function reconciliationControls(snapshot: AccountingReviewSnapshot): AccountingControl[] {
  const controls: AccountingControl[] = [];
  const reconciliationIssues = snapshot.reconciliationIssues ?? [];
  if (reconciliationIssues.length > 0) {
    controls.push({
      code: "RECONCILIATION_ISSUES",
      severity: "warning",
      category: "reconciliation",
      title: `${reconciliationIssues.length} point${reconciliationIssues.length > 1 ? "s" : ""} de rapprochement à traiter`,
      detail: "Les rapprochements ligne à ligne ont détecté des écarts, comptes d'attente ou mouvements non matchés.",
      action: { label: "Ouvrir les rapprochements", href: "/rapprochements" },
      evidence: reconciliationIssues.slice(0, 10),
      openIssueCount: reconciliationIssues.length,
      handledIssueCount: 0,
    });
    return controls;
  }
  if (snapshot.stripeCandidates.length > 0) {
    controls.push({
      code: "STRIPE_RECONCILIATION",
      severity: "warning",
      category: "reconciliation",
      title: "Rapprochement Stripe à compléter",
      detail: "Les payouts Stripe doivent être rapprochés avec le détail des frais et paiements Stripe.",
      action: { label: "Traiter Stripe", href: "/controle/STRIPE_RECONCILIATION" },
      evidence: snapshot.stripeCandidates,
      openIssueCount: 0,
      handledIssueCount: 0,
    });
  }
  if (snapshot.hasBankEntries) {
    controls.push({
      code: "BANK_RECONCILIATION",
      severity: "warning",
      category: "reconciliation",
      title: "Rapprochement bancaire à confirmer",
      detail: "Le solde du compte 5121 doit être rapproché avec le relevé bancaire de fin d'exercice.",
      action: { label: "Traiter la banque", href: "/controle/BANK_RECONCILIATION" },
      evidence: [{
        issueKey: issueKey("BANK_RECONCILIATION", "account", "5121"),
        entityType: "account",
        entityId: "5121",
        label: "Compte banque",
        account: "5121",
      }],
      openIssueCount: 0,
      handledIssueCount: 0,
    });
  }
  return controls;
}

function accountFromIssueKey(issueKey: string) {
  const match = issueKey.match(/account:([^:]+)/);
  return match?.[1];
}

function isAnnualChargeCandidate(transaction: {
  label: string;
  normalizedLabel: string;
  counterparty: string | null;
  categorization: { isAnnualCharge: boolean; accountDebit: string | null } | null;
}) {
  const text = `${transaction.label} ${transaction.normalizedLabel} ${transaction.counterparty ?? ""}`.toLowerCase();
  return Boolean(transaction.categorization?.isAnnualCharge || /\b(annual|annuel|annuelle|assurance|rc pro)\b/i.test(text));
}

function isFixedAssetCandidate(transaction: {
  amount: { toNumber(): number };
  label: string;
  notes: string | null;
  sourceCategory: string | null;
  categorization: { accountDebit: string | null; accountCredit: string | null } | null;
}) {
  const amount = Math.abs(transaction.amount.toNumber());
  const account = transaction.categorization?.accountDebit ?? transaction.categorization?.accountCredit ?? "";
  const text = `${transaction.label} ${transaction.notes ?? ""} ${transaction.sourceCategory ?? ""}`.toLowerCase();
  return account.startsWith("2") || (amount >= 500 && /\b(macbook|ordinateur|materiel|matériel|immobilisation)\b/i.test(text));
}

function isStripeReconciliationCandidate(transaction: {
  label: string;
  counterparty: string | null;
  notes: string | null;
  categorization: { accountDebit: string | null; accountCredit: string | null } | null;
}) {
  const account = `${transaction.categorization?.accountDebit ?? ""} ${transaction.categorization?.accountCredit ?? ""}`;
  const text = `${transaction.label} ${transaction.counterparty ?? ""} ${transaction.notes ?? ""}`.toLowerCase();
  return account.includes("5115") || /\b(stripe|payout)\b/i.test(text);
}

function transactionEvidence(
  transaction: {
    id?: string;
    date: Date;
    label: string;
    amount: { toString(): string };
  },
  account: string,
  controlCode?: string
): AccountingControlEvidence {
  return {
    issueKey: controlCode && transaction.id ? issueKey(controlCode, "transaction", transaction.id) : undefined,
    entityType: transaction.id ? "transaction" : undefined,
    entityId: transaction.id,
    label: transaction.label,
    amount: transaction.amount.toString(),
    account,
    date: transaction.date.toISOString().slice(0, 10),
  };
}

function applyResolutionState(control: AccountingControl, resolutions: AccountingIssueResolutionState[]): AccountingControl {
  const byKey = new Map(resolutions.map((resolution) => [resolution.issueKey, resolution]));
  const evidence = control.evidence.map((item) => {
    const resolution = item.issueKey ? byKey.get(item.issueKey) : undefined;
    return resolution ? { ...item, resolutionStatus: resolution.status, note: resolution.note } : item;
  });
  const tracked = evidence.filter((item) => item.issueKey);
  const openIssueCount = tracked.filter((item) => !item.resolutionStatus || item.resolutionStatus === "OPEN").length;
  const handledIssueCount = tracked.filter((item) => item.resolutionStatus === "RESOLVED" || item.resolutionStatus === "IGNORED").length;
  return { ...control, evidence, openIssueCount, handledIssueCount };
}

function filterControlByIssueState(control: AccountingControl, options: { includeHandledIssues?: boolean }): AccountingControl[] {
  if (options.includeHandledIssues || control.severity === "blocking") return [control];
  const tracked = control.evidence.filter((item) => item.issueKey);
  if (tracked.length === 0) return [control];
  const activeEvidence = control.evidence.filter((item) => !item.issueKey || !item.resolutionStatus || item.resolutionStatus === "OPEN");
  if (activeEvidence.length === 0) return [];
  return [{ ...control, evidence: activeEvidence, openIssueCount: activeEvidence.filter((item) => item.issueKey).length }];
}

export function issueKey(controlCode: string, entityType: string, entityId: string) {
  return `${controlCode}:${entityType}:${entityId}`;
}

function displayAccount(amount: number, categorization: { accountDebit: string | null; accountCredit: string | null } | null) {
  if (!categorization) return "471";
  return amount >= 0 ? categorization.accountCredit ?? "471" : categorization.accountDebit ?? "471";
}

function latestDate(dates: Date[]) {
  if (dates.length === 0) return null;
  return dates.reduce((latest, date) => date > latest ? date : latest, dates[0]);
}

function blockedDocumentMessage(count: number) {
  return `Génération bloquée : ${count} contrôle${count > 1 ? "s" : ""} bloquant${count > 1 ? "s" : ""} à résoudre dans Contrôle.`;
}

function formatEuro(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}

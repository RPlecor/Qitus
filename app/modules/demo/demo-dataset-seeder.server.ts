import { execFile } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { LegalForm, VatRegime } from "@prisma/client";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { getDevCompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { getAiProviderMode, getCodexCliBin } from "../env.server";
import { AttachmentCenter } from "../evidence/attachment-center.server";
import { AttachmentLinkCenter } from "../evidence/attachment-link-center.server";
import { ClosingWorkpaperCenter } from "../closing-workpapers/closing-workpaper-center.server";
import { ImportOrchestrator } from "../import-orchestrator/import-orchestrator.server";
import { seedGlobalVendorMappings } from "./vendor-mapping-seed.server";

const execFileAsync = promisify(execFile);

export type DemoWorkspaceState = {
  imports: number;
  transactions: number;
  categorizations: number;
  reviewTransactions: number;
  journalEntries: number;
  journalLines: number;
  documents: number;
  fixedAssets: number;
  bankReconciliations: number;
};

export type DemoDatasetId = "qonto_mvp" | "multi_bank" | "regime_reel_tva" | "closing_beta";

export type DemoDatasetDefinition = {
  id: DemoDatasetId;
  label: string;
  description: string;
  companyFixture: string;
  bankImports: string[];
  seedClosingContext?: boolean;
  expectedState?: DemoWorkspaceState;
};

export type DemoDatasetSeedResult = {
  dataset: DemoDatasetDefinition;
  state: DemoWorkspaceState;
};

const QONTO_MVP_EXPECTED_STATE: DemoWorkspaceState = {
  imports: 1,
  transactions: 42,
  categorizations: 42,
  reviewTransactions: 2,
  journalEntries: 40,
  journalLines: 80,
  documents: 0,
  fixedAssets: 0,
  bankReconciliations: 0,
};

const CLOSING_BETA_EXPECTED_STATE: DemoWorkspaceState = {
  ...QONTO_MVP_EXPECTED_STATE,
  fixedAssets: 2,
  bankReconciliations: 1,
};

export const DEMO_DATASETS: DemoDatasetDefinition[] = [
  {
    id: "qonto_mvp",
    label: "MVP Qonto",
    description: "Scénario reproductible utilisé par validate:mvp et validate:end-user.",
    companyFixture: "companies/sasu-consulting.json",
    bankImports: ["bank-imports/qonto-export-2025.csv"],
    expectedState: QONTO_MVP_EXPECTED_STATE,
  },
  {
    id: "multi_bank",
    label: "Multi-banques CSV",
    description: "Charge les fixtures Qonto, BNP, SG et Boursorama pour durcir les parsers et l'idempotence d'import.",
    companyFixture: "companies/sasu-consulting.json",
    bankImports: [
      "bank-imports/qonto-export-2025.csv",
      "bank-imports/bnp-export-2025.csv",
      "bank-imports/sg-export-2025.csv",
      "bank-imports/boursorama-export-2025.csv",
    ],
  },
  {
    id: "regime_reel_tva",
    label: "SARL TVA réel",
    description: "Charge le profil SARL commerce au réel simplifié pour tester les écritures TVA.",
    companyFixture: "companies/sarl-commerce.json",
    bankImports: ["bank-imports/bnp-export-2025.csv"],
  },
  {
    id: "closing_beta",
    label: "Clôture beta",
    description: "Charge le scénario MVP Qonto avec immobilisations et rapprochement bancaire de clôture.",
    companyFixture: "companies/sasu-consulting.json",
    bankImports: ["bank-imports/qonto-export-2025.csv"],
    seedClosingContext: true,
    expectedState: CLOSING_BETA_EXPECTED_STATE,
  },
];

export function getExpectedDemoState(datasetId: string | null | undefined = "qonto_mvp"): DemoWorkspaceState {
  return getDemoDatasetDefinition(datasetId).expectedState ?? QONTO_MVP_EXPECTED_STATE;
}

export function getDemoDatasetDefinition(datasetId: string | null | undefined): DemoDatasetDefinition {
  const normalized = normalizeDemoDatasetId(datasetId);
  const dataset = DEMO_DATASETS.find((candidate) => candidate.id === normalized);
  if (!dataset) {
    const ids = DEMO_DATASETS.map((candidate) => candidate.id).join(", ");
    throw new Error(`Dataset démo inconnu "${datasetId}". Datasets disponibles : ${ids}.`);
  }
  return dataset;
}

export function normalizeDemoDatasetId(datasetId: string | null | undefined): DemoDatasetId {
  const raw = (datasetId ?? process.env.DEMO_DATASET ?? "qonto_mvp").trim();
  return (raw || "qonto_mvp") as DemoDatasetId;
}

export class DemoDatasetSeeder {
  async resetDemoWorkspace(input: { datasetId?: string | null } = {}): Promise<DemoDatasetSeedResult> {
    const dataset = getDemoDatasetDefinition(input.datasetId);
    assertLocalDemoEnvironment(process.env.DATABASE_URL);
    await assertAiProviderReady();

    await prisma.user.deleteMany({ where: { clerkId: "dev-user" } });
    await removeGeneratedStorage();
    await seedGlobalVendorMappings(prisma);

    let workspace = await getDevCompanyWorkspace();
    workspace = await applyCompanyFixture(workspace, dataset.companyFixture);

    for (const fixture of dataset.bankImports) {
      await importBankFixture(workspace, fixture);
    }

    if (dataset.seedClosingContext) {
      await seedClosingContext(workspace);
    }

    const state = await getDemoWorkspaceState(workspace.fiscalYear.id);
    if (dataset.expectedState) {
      const diff = formatDemoStateDiff(state, dataset.expectedState);
      if (diff.length > 0) {
        throw new Error(`Reset démo incomplet pour ${dataset.id} : ${diff.join(", ")}.`);
      }
    }

    return { dataset, state };
  }
}

export async function getDemoWorkspaceState(fiscalYearId: string): Promise<DemoWorkspaceState> {
  const [
    imports,
    transactions,
    categorizations,
    reviewTransactions,
    journalEntries,
    journalLines,
    documents,
    fixedAssets,
    bankReconciliations,
  ] = await Promise.all([
    prisma.import.count({ where: { fiscalYearId } }),
    prisma.transaction.count({ where: { fiscalYearId } }),
    prisma.categorization.count({ where: { fiscalYearId } }),
    prisma.categorization.count({ where: { fiscalYearId, status: "NEEDS_REVIEW" } }),
    prisma.journalEntry.count({ where: { fiscalYearId } }),
    prisma.journalLine.count({ where: { journalEntry: { fiscalYearId } } }),
    prisma.document.count({ where: { fiscalYearId } }),
    prisma.fixedAsset.count({ where: { fiscalYearId } }),
    prisma.bankReconciliation.count({ where: { fiscalYearId } }),
  ]);

  return {
    imports,
    transactions,
    categorizations,
    reviewTransactions,
    journalEntries,
    journalLines,
    documents,
    fixedAssets,
    bankReconciliations,
  };
}

export function assertLocalDemoEnvironment(databaseUrl: string | undefined) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Le reset démo est interdit avec NODE_ENV=production.");
  }
  if (!databaseUrl || !isLocalDemoDatabase(databaseUrl)) {
    throw new Error("Le reset démo exige une DATABASE_URL locale Paperasse.");
  }
}

export function isLocalDemoDatabase(databaseUrl: string) {
  try {
    const parsed = new URL(databaseUrl);
    const host = parsed.hostname.toLowerCase();
    const databaseName = parsed.pathname.replace(/^\//, "").toLowerCase();
    return ["localhost", "127.0.0.1", "::1"].includes(host) && databaseName.includes("paperasse");
  } catch {
    return databaseUrl.toLowerCase().includes("localhost") && databaseUrl.toLowerCase().includes("paperasse");
  }
}

export function formatDemoStateDiff(actual: DemoWorkspaceState, expected: DemoWorkspaceState) {
  return (Object.keys(expected) as Array<keyof DemoWorkspaceState>).flatMap((key) => (
    actual[key] === expected[key] ? [] : `${key} attendu=${expected[key]} obtenu=${actual[key]}`
  ));
}

async function assertAiProviderReady() {
  const provider = getAiProviderMode();
  if (provider !== "codex-cli" && provider !== "auto") return;

  try {
    await execFileAsync(getCodexCliBin(), ["login", "status"], { timeout: 10_000 });
  } catch {
    throw new Error("Codex CLI n'est pas connecté. Lance `codex --login` puis choisis Sign in with ChatGPT.");
  }
}

async function removeGeneratedStorage() {
  const storageDir = process.env.DOCUMENT_STORAGE_DIR ?? path.join(process.cwd(), "storage", "documents");
  await rm(storageDir, { recursive: true, force: true });
  await rm(process.env.EVIDENCE_STORAGE_DIR ?? path.join(process.cwd(), "storage", "evidence"), { recursive: true, force: true });
  await rm(path.join(process.cwd(), "storage", "imports"), { recursive: true, force: true });
}

async function importBankFixture(workspace: CompanyWorkspace, fixture: string) {
  const fixturePath = path.join(process.cwd(), "fixtures", fixture);
  const content = await readFile(fixturePath, "utf8");
  await new ImportOrchestrator({ meterUsage: false }).startCsvImport(workspace, {
    filename: path.basename(fixture),
    content,
  });
}

async function applyCompanyFixture(workspace: CompanyWorkspace, fixture: string): Promise<CompanyWorkspace> {
  const parsed = await readJsonFixture<CompanyFixture>(fixture);
  const company = parsed.company;
  const manager = company.manager ?? company.president;
  const managerName = splitPersonName(manager?.name);
  const fiscalYear = company.fiscal_year;
  const bankAccount = company.bank_accounts[0];

  await prisma.company.update({
    where: { id: workspace.company.id },
    data: {
      name: company.name,
      legalForm: normalizeLegalForm(company.legal_form),
      siren: company.siren,
      siret: company.siret,
      nafCode: company.naf_code,
      rcs: company.rcs,
      capital: numberOrNull(company.capital),
      addressStreet: company.address?.street,
      addressPostal: company.address?.postal_code,
      addressCity: company.address?.city,
      managerFirstName: managerName.firstName,
      managerLastName: managerName.lastName,
      managerRole: manager?.role,
      corporateTax: company.tax_regime.corporate_tax === "IR" ? "IR" : "IS",
      vatRegime: normalizeVatRegime(company.tax_regime.vat_regime),
      vatRate: company.tax_regime.vat_rate_default != null ? String(Number(company.tax_regime.vat_rate_default) / 100) : null,
      incomeRegime: company.tax_regime.income_tax_regime,
      onboardingComplete: true,
    },
  });

  await prisma.fiscalYear.update({
    where: { id: workspace.fiscalYear.id },
    data: {
      startDate: new Date(fiscalYear.start),
      endDate: new Date(fiscalYear.end),
      status: "OPEN",
    },
  });

  if (bankAccount) {
    await prisma.bankAccount.update({
      where: { id: workspace.bankAccount.id },
      data: {
        bank: bankAccount.bank,
        label: bankAccount.label,
        iban: bankAccount.iban,
        pcgAccount: bankAccount.pcg_account ?? "5121",
        fecAccount: bankAccount.pcg_account === "5121" ? "51211" : bankAccount.pcg_account ?? "51211",
      },
    });
  }

  return getDevCompanyWorkspace();
}

async function seedClosingContext(workspace: CompanyWorkspace) {
  const context = await readJsonFixture<ClosingContextFixture>("cloture/cloture-context.json");
  await prisma.fixedAsset.deleteMany({ where: { fiscalYearId: workspace.fiscalYear.id } });
  await prisma.bankReconciliation.deleteMany({ where: { fiscalYearId: workspace.fiscalYear.id } });

  for (const asset of context.immobilisations) {
    await prisma.fixedAsset.create({
      data: {
        fiscalYearId: workspace.fiscalYear.id,
        label: asset.label,
        account: asset.account,
        acquisitionDate: new Date(asset.acquisition_date),
        amount: String(asset.amount_ht),
        method: "LINEAR",
        usefulLifeYears: asset.useful_life_years,
        depreciationAccount: asset.depreciation_account,
        expenseAccount: asset.dotation_account,
      },
    });
  }

  const reconciliation = context.rapprochement_bancaire;
  if (reconciliation) {
    await prisma.bankReconciliation.create({
      data: {
        fiscalYearId: workspace.fiscalYear.id,
        bankAccountId: workspace.bankAccount.id,
        statementDate: new Date(reconciliation.date),
        statementBalance: String(reconciliation.solde_releve_bancaire),
        ledgerBalance: String(reconciliation.solde_comptable),
        difference: String(reconciliation.ecart),
        status: reconciliation.status === "rapproche" ? "MATCHED" : "DIFFERENCE",
        confirmedAt: reconciliation.status === "rapproche" ? new Date() : null,
      },
    });
  }

  await seedClosingEvidence(workspace);
  await seedClosingWorkpapers(workspace);
}

async function seedClosingWorkpapers(workspace: CompanyWorkspace) {
  const center = new ClosingWorkpaperCenter();
  const workpapers = [
    {
      kind: "FNP",
      title: "FNP - facture hébergement décembre non reçue",
      amount: 360,
      debitAccount: "615",
      creditAccount: "4081",
      basis: "Charge de décembre rattachable à N, facture attendue en janvier.",
    },
    {
      kind: "FAE",
      title: "FAE - audit SI livré non facturé",
      amount: 2400,
      debitAccount: "4181",
      creditAccount: "706",
      basis: "Prestation livrée en décembre, facture à établir début janvier.",
    },
    {
      kind: "PCA",
      title: "PCA - abonnement client encaissé d'avance",
      amount: 900,
      debitAccount: "706",
      creditAccount: "487",
      basis: "Part de produit rattachée à l'exercice suivant.",
    },
    {
      kind: "STOCK_VARIATION",
      title: "Variation de stock marchandises",
      amount: 1200,
      debitAccount: "37",
      creditAccount: "6037",
      basis: "Stock final supérieur au stock initial selon inventaire local.",
      initialStock: 800,
      finalStock: 2000,
    },
    {
      kind: "PROVISION",
      title: "Provision litige fournisseur",
      amount: 1500,
      debitAccount: "6815",
      creditAccount: "151",
      basis: "Risque probable documenté par note utilisateur.",
    },
    {
      kind: "LOAN_INTEREST_ACCRUAL",
      title: "Intérêts courus emprunt bancaire",
      amount: 0,
      debitAccount: "6611",
      creditAccount: "1688",
      basis: "Intérêts courus non échus calculés prorata temporis.",
      capital: 25000,
      annualRate: 0.045,
      days: 92,
    },
    {
      kind: "PAYROLL_ACCRUAL",
      title: "Paie et charges sociales à payer",
      amount: 1800,
      debitAccount: "641",
      creditAccount: "428",
      basis: "Charges de paie de décembre à payer en janvier.",
    },
  ];
  for (const workpaper of workpapers) {
    await center.saveWorkpaper(workspace, {
      kind: workpaper.kind,
      title: workpaper.title,
      status: "READY",
      assumptions: {
        amount: workpaper.amount,
        debitAccount: workpaper.debitAccount,
        creditAccount: workpaper.creditAccount,
        basis: workpaper.basis,
        requiredEvidence: true,
        initialStock: workpaper.initialStock,
        finalStock: workpaper.finalStock,
        capital: workpaper.capital,
        annualRate: workpaper.annualRate,
        days: workpaper.days,
      },
    });
  }
}

async function seedClosingEvidence(workspace: CompanyWorkspace) {
  const fixtures = [
    { filename: "ovh-facture.txt", labelContains: "OVH CLOUD HOSTING JANVIER", relationType: "INVOICE" as const },
    { filename: "google-facture.txt", labelContains: "GOOGLE WORKSPACE BUSINESS", relationType: "INVOICE" as const },
    { filename: "bigcorp-contrat.txt", labelContains: "MISSION AUDIT SI JANVIER", relationType: "CONTRACT" as const },
  ];
  const attachments = new AttachmentCenter();
  const links = new AttachmentLinkCenter();

  for (const fixture of fixtures) {
    const transaction = await prisma.transaction.findFirst({
      where: { fiscalYearId: workspace.fiscalYear.id, label: { contains: fixture.labelContains } },
      orderBy: { date: "asc" },
    });
    if (!transaction) continue;
    const bytes = await readFile(path.join(process.cwd(), "fixtures", "evidence", fixture.filename));
    const attachment = await attachments.uploadAttachment(workspace, {
      filename: fixture.filename,
      mimeType: "text/plain",
      bytes,
    });
    await links.linkAttachment(workspace, {
      attachmentId: attachment.id,
      entityType: "TRANSACTION",
      entityId: transaction.id,
      relationType: fixture.relationType,
      note: "Pièce chargée par le dataset closing_beta",
    });
  }
}

async function readJsonFixture<T>(fixture: string): Promise<T> {
  const content = await readFile(path.join(process.cwd(), "fixtures", fixture), "utf8");
  return JSON.parse(content) as T;
}

function normalizeLegalForm(value: string | undefined): LegalForm {
  const legalForm = value?.toUpperCase();
  return (["SASU", "SARL", "SAS", "SA", "SCI"].includes(legalForm ?? "") ? legalForm : "AUTRE") as LegalForm;
}

function normalizeVatRegime(value: string | undefined): VatRegime {
  if (value === "franchise_en_base") return "FRANCHISE";
  if (value === "reel_simplifie") return "REEL_SIMPLIFIE";
  if (value === "reel_normal") return "REEL_NORMAL";
  return "FRANCHISE";
}

function splitPersonName(name: string | undefined) {
  if (!name) return { firstName: null, lastName: null };
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: null, lastName: parts[0] };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
}

function numberOrNull(value: number | undefined) {
  return typeof value === "number" ? value : null;
}

type CompanyFixture = {
  company: {
    name: string;
    legal_form: string;
    siren?: string;
    siret?: string;
    naf_code?: string;
    rcs?: string;
    capital?: number;
    address?: {
      street?: string;
      postal_code?: string;
      city?: string;
    };
    manager?: { name?: string; role?: string };
    president?: { name?: string; role?: string };
    fiscal_year: {
      start: string;
      end: string;
    };
    tax_regime: {
      corporate_tax?: string;
      vat_regime?: string;
      vat_rate_default?: number;
      income_tax_regime?: string | null;
    };
    bank_accounts: Array<{
      bank: string;
      iban?: string;
      label: string;
      pcg_account?: string;
    }>;
  };
};

type ClosingContextFixture = {
  immobilisations: Array<{
    label: string;
    account: string;
    acquisition_date: string;
    amount_ht: number;
    useful_life_years: number;
    depreciation_account: string;
    dotation_account: string;
  }>;
  rapprochement_bancaire?: {
    date: string;
    solde_comptable: number;
    solde_releve_bancaire: number;
    ecart: number;
    status: string;
  };
};

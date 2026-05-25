import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { VatReferenceCenter } from "../official-references/vat-reference-center.server";

export type VatLedgerReadinessStatus = "ok" | "warning" | "action_required";

export type VatLedgerReadinessAction = {
  label: string;
  href: string;
  primary?: boolean;
};

export type VatLedgerReadiness = {
  status: VatLedgerReadinessStatus;
  title: string;
  message: string;
  counters: {
    parsedImports: number;
    reviewImports: number;
    importEntries: number;
    importEntriesWithVat: number;
    importEntriesWithoutVat: number;
    taxableCategorizations: number;
    zeroVatDeclarations: number;
    transactionsInReview: number;
  };
  actions: VatLedgerReadinessAction[];
};

export type VatLedgerReadinessSnapshot = VatLedgerReadiness["counters"] & {
  vatRegime: string;
  requiredVatAccounts?: string[];
};

export class VatLedgerReadinessCenter {
  constructor(private readonly vatReference = new VatReferenceCenter()) {}

  async getReadiness(workspace: CompanyWorkspace): Promise<VatLedgerReadiness> {
    const accounts = await this.vatReference.getVatAccounts();
    const requiredVatAccounts = [accounts.deductible, accounts.collected, accounts.reverseCharge];
    const [
      parsedImports,
      reviewImports,
      importEntries,
      importEntriesWithVat,
      importEntriesWithoutVat,
      taxableCategorizations,
      transactionsInReview,
      declarations,
    ] = await Promise.all([
      prisma.import.count({ where: { fiscalYearId: workspace.fiscalYear.id, parsedRows: { gt: 0 } } }),
      prisma.import.count({ where: { fiscalYearId: workspace.fiscalYear.id, status: "REVIEW", parsedRows: { gt: 0 } } }),
      prisma.journalEntry.count({ where: { fiscalYearId: workspace.fiscalYear.id, source: "IMPORT" } }),
      prisma.journalEntry.count({
        where: {
          fiscalYearId: workspace.fiscalYear.id,
          source: "IMPORT",
          lines: { some: { account: { in: requiredVatAccounts } } },
        },
      }),
      prisma.journalEntry.count({
        where: {
          fiscalYearId: workspace.fiscalYear.id,
          source: "IMPORT",
          lines: { none: { account: { in: requiredVatAccounts } } },
        },
      }),
      prisma.categorization.count({
        where: {
          fiscalYearId: workspace.fiscalYear.id,
          status: { notIn: ["NEEDS_REVIEW", "REVIEW_LIGHT"] },
          vatRate: { gt: 0 },
        },
      }),
      prisma.categorization.count({ where: { fiscalYearId: workspace.fiscalYear.id, status: "NEEDS_REVIEW" } }),
      prisma.vatDeclaration.findMany({
        where: { fiscalYearId: workspace.fiscalYear.id, status: "DRAFT" },
        select: { amountsJson: true },
      }),
    ]);

    return buildVatLedgerReadiness({
      vatRegime: workspace.company.vatRegime,
      parsedImports,
      reviewImports,
      importEntries,
      importEntriesWithVat,
      importEntriesWithoutVat,
      taxableCategorizations,
      zeroVatDeclarations: declarations.filter((declaration) => isZeroVatAmounts(declaration.amountsJson)).length,
      transactionsInReview,
      requiredVatAccounts,
    });
  }
}

export function buildVatLedgerReadiness(snapshot: VatLedgerReadinessSnapshot): VatLedgerReadiness {
  const requiredVatAccounts = snapshot.requiredVatAccounts ?? [];
  const accountHint = requiredVatAccounts.length > 0 ? ` (${requiredVatAccounts.join(", ")})` : "";
  const counters = {
    parsedImports: snapshot.parsedImports,
    reviewImports: snapshot.reviewImports,
    importEntries: snapshot.importEntries,
    importEntriesWithVat: snapshot.importEntriesWithVat,
    importEntriesWithoutVat: snapshot.importEntriesWithoutVat,
    taxableCategorizations: snapshot.taxableCategorizations,
    zeroVatDeclarations: snapshot.zeroVatDeclarations,
    transactionsInReview: snapshot.transactionsInReview,
  };

  if (snapshot.vatRegime === "FRANCHISE") {
    return readiness("ok", "TVA non applicable", "L'entreprise est en franchise en base : les écritures restent sans lignes TVA.", counters, []);
  }

  if (snapshot.parsedImports === 0 && snapshot.importEntries === 0) {
    return readiness("ok", "Aucune écriture TVA attendue", "Aucun import bancaire n'a encore alimenté l'exercice.", counters, []);
  }

  const actions = [
    { label: "Relancer la catégorisation", href: "/imports", primary: true },
    { label: "Voir les transactions à vérifier", href: "/transactions?status=review" },
  ];

  if (snapshot.reviewImports > 0 || snapshot.transactionsInReview > 0) {
    return readiness(
      "warning",
      "TVA à finaliser après revue des transactions",
      "Des imports ou transactions sont encore à vérifier. La position TVA et la déclaration peuvent rester à 0 tant que la catégorisation n'est pas relancée ou confirmée.",
      counters,
      actions
    );
  }

  if (snapshot.importEntries > 0 && snapshot.importEntriesWithVat === 0) {
    return readiness(
      "action_required",
      "Écritures existantes sans lignes TVA",
      `Le régime TVA est réel, mais les écritures d'import existantes ne contiennent aucune ligne TVA attendue${accountHint}. Elles doivent être recalculées ou corrigées avant de produire une déclaration exploitable.`,
      counters,
      actions
    );
  }

  if (snapshot.importEntriesWithoutVat > 0 && snapshot.taxableCategorizations > 0) {
    return readiness(
      "warning",
      "Certaines écritures n'ont pas de lignes TVA",
      "Qitus détecte des catégorisations taxables, mais certaines écritures d'import restent sans compte TVA. Vérifiez les transactions concernées avant de déposer la déclaration.",
      counters,
      actions
    );
  }

  if (snapshot.zeroVatDeclarations > 0 && snapshot.importEntriesWithVat === 0) {
    return readiness(
      "warning",
      "Déclaration TVA générée sans base TVA",
      "Une déclaration TVA existe avec des montants à zéro alors que l'exercice contient des imports. Vérifiez les écritures avant de régénérer la déclaration.",
      counters,
      actions
    );
  }

  return readiness("ok", "Écritures TVA exploitables", "Les écritures de l'exercice permettent de calculer une position TVA.", counters, []);
}

function readiness(status: VatLedgerReadinessStatus, title: string, message: string, counters: VatLedgerReadiness["counters"], actions: VatLedgerReadinessAction[]): VatLedgerReadiness {
  return { status, title, message, counters, actions };
}

function isZeroVatAmounts(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const amounts = value as Record<string, unknown>;
  return ["deductible", "collected", "reverseChargeDue", "net"].every((key) => Number(amounts[key] ?? 0) === 0);
}

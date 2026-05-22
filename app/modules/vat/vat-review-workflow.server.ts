import type { Prisma, VatDeclarationType } from "@prisma/client";
import { ActivityLogCenter } from "../activity-log/activity-log-center.server";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { ExpectedRouteError } from "../route-errors.server";
import { TransactionCorrectionFlow } from "../transactions/transaction-correction-flow.server";
import { VatDeclarationCenter } from "./vat-declaration-center.server";
import { VatDeclarationFreshnessCenter } from "./vat-declaration-freshness-center.server";
import { isTaxableVatNature, parseVatOperationNature, parseVatRate, vatNatureLabel, vatRateLabel } from "./vat-rate-policy";
import type { VatPositionFilters } from "./vat-position-center.server";

export type VatReviewIssue = {
  issueKey: string;
  code: "VAT_RATE_MISSING" | "VAT_NATURE_MISSING" | "VAT_DECLARATION_STALE";
  severity: "blocking" | "warning";
  title: string;
  detail: string;
  actionLabel: string;
  href: string;
  transaction?: {
    id: string;
    label: string;
    date: string;
    amount: string;
    accountDebit: string;
    accountCredit: string;
    ecritureLabel: string;
    vatRate: string | null;
    vatOperationNature: string | null;
  };
  declaration?: {
    id: string;
    type: string;
    periodStart: string;
    periodEnd: string;
    staleReasons: string[];
  };
};

export type VatReviewQueue = {
  issues: VatReviewIssue[];
  blockingCount: number;
  warningCount: number;
  empty: boolean;
};

export class VatReviewWorkflow {
  constructor(
    private readonly correctionFlow = new TransactionCorrectionFlow(),
    private readonly declarations = new VatDeclarationCenter(),
    private readonly declarationFreshness = new VatDeclarationFreshnessCenter(),
    private readonly activity = new ActivityLogCenter()
  ) {}

  async getReviewQueue(workspace: CompanyWorkspace, _filters: VatPositionFilters = {}): Promise<VatReviewQueue> {
    if (workspace.company.vatRegime === "FRANCHISE") {
      return { issues: [], blockingCount: 0, warningCount: 0, empty: true };
    }

    const [missingRate, missingNature, freshness] = await Promise.all([
      prisma.categorization.findMany({
        where: taxableCategorizationWhere(workspace, { vatRate: null }),
        include: { transaction: true },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.categorization.findMany({
        where: {
          fiscalYearId: workspace.fiscalYear.id,
          status: { not: "NEEDS_REVIEW" },
          transaction: { journalEntryId: { not: null } },
          vatRate: { not: null },
          vatOperationNature: null,
        },
        include: { transaction: true },
        orderBy: { updatedAt: "desc" },
      }),
      this.declarationFreshness.getFreshness(workspace),
    ]);

    const issues = [
      ...missingRate.map((categorization) => transactionIssue("VAT_RATE_MISSING", categorization)),
      ...missingNature.map((categorization) => transactionIssue("VAT_NATURE_MISSING", categorization)),
      ...freshness.declarations.filter((declaration) => declaration.isStale).map((declaration): VatReviewIssue => ({
        issueKey: `VAT_DECLARATION_STALE:declaration:${declaration.declarationId}`,
        code: "VAT_DECLARATION_STALE",
        severity: "warning",
        title: "Déclaration TVA obsolète",
        detail: `${declaration.type} ${declaration.periodStart} → ${declaration.periodEnd} doit être régénérée.`,
        actionLabel: "Régénérer",
        href: `/tva/revue?issue=${encodeURIComponent(`VAT_DECLARATION_STALE:declaration:${declaration.declarationId}`)}`,
        declaration: {
          id: declaration.declarationId,
          type: declaration.type,
          periodStart: declaration.periodStart,
          periodEnd: declaration.periodEnd,
          staleReasons: declaration.staleReasons.map((reason) => reason.label),
        },
      })),
    ];

    return {
      issues,
      blockingCount: issues.filter((issue) => issue.severity === "blocking").length,
      warningCount: issues.filter((issue) => issue.severity === "warning").length,
      empty: issues.length === 0,
    };
  }

  async getIssue(workspace: CompanyWorkspace, issueKey: string): Promise<VatReviewIssue> {
    const issue = (await this.getReviewQueue(workspace)).issues.find((candidate) => candidate.issueKey === issueKey);
    if (!issue) throw new ExpectedRouteError("Point de revue TVA introuvable ou déjà résolu.", 404);
    return issue;
  }

  async resolveIssue(workspace: CompanyWorkspace, input: { issueKey: string; vatRate?: string | null; vatOperationNature?: string | null }) {
    const issue = await this.getIssue(workspace, input.issueKey);
    if (issue.transaction) {
      const vatRate = input.vatRate === undefined ? issue.transaction.vatRate : input.vatRate;
      const vatOperationNature = input.vatOperationNature === undefined ? issue.transaction.vatOperationNature : input.vatOperationNature;
      if (issue.code === "VAT_RATE_MISSING" && parseVatRate(vatRate) === null) {
        throw new ExpectedRouteError("Choisis un taux TVA pour résoudre ce point.", 400);
      }
      if (issue.code === "VAT_NATURE_MISSING" && !parseVatOperationNature(vatOperationNature)) {
        throw new ExpectedRouteError("Choisis une nature TVA pour résoudre ce point.", 400);
      }
      const result = await this.correctionFlow.confirmCategorization({
        transactionId: issue.transaction.id,
        accountDebit: issue.transaction.accountDebit,
        accountCredit: issue.transaction.accountCredit,
        vatRate,
        vatOperationNature,
        ecritureLabel: issue.transaction.ecritureLabel,
        learn: false,
      });
      await this.activity.recordActivity(workspace, {
        action: "vat.issue_resolved",
        entityType: "transaction",
        entityId: issue.transaction.id,
        metadata: { issueKey: issue.issueKey, vatRate: result.categorization.vatRate?.toString() ?? null, vatOperationNature: result.categorization.vatOperationNature },
      });
      return { issue, resolved: true, result };
    }

    if (issue.declaration) {
      const result = await this.declarations.generateDraft(workspace, {
        type: issue.declaration.type as VatDeclarationType,
        dateFrom: issue.declaration.periodStart,
        dateTo: issue.declaration.periodEnd,
      });
      await this.activity.recordActivity(workspace, {
        action: "vat.issue_resolved",
        entityType: "vat_declaration",
        entityId: issue.declaration.id,
        metadata: { issueKey: issue.issueKey, regeneratedDeclarationId: result.declaration.id },
      });
      return { issue, resolved: true, result };
    }

    throw new ExpectedRouteError("Ce point TVA ne possède pas d'action de résolution.", 400);
  }

  async summarizeVatReadiness(workspace: CompanyWorkspace, filters: VatPositionFilters = {}) {
    const queue = await this.getReviewQueue(workspace, filters);
    return {
      status: queue.blockingCount > 0 ? "blocked" : queue.warningCount > 0 ? "ready_with_warnings" : "ready",
      blockingCount: queue.blockingCount,
      warningCount: queue.warningCount,
      issueCount: queue.issues.length,
      nextIssue: queue.issues[0] ?? null,
    };
  }
}

function taxableCategorizationWhere(workspace: CompanyWorkspace, extra: Prisma.CategorizationWhereInput): Prisma.CategorizationWhereInput {
  return {
    fiscalYearId: workspace.fiscalYear.id,
    status: { not: "NEEDS_REVIEW" },
    transaction: { journalEntryId: { not: null } },
    vatOperationNature: { in: ["DOMESTIC_PURCHASE", "DOMESTIC_SALE", "INTRACOM_PURCHASE", "REVERSE_CHARGE"] },
    ...extra,
  };
}

function transactionIssue(
  code: "VAT_RATE_MISSING" | "VAT_NATURE_MISSING",
  categorization: Prisma.CategorizationGetPayload<{ include: { transaction: true } }>
): VatReviewIssue {
  const transaction = categorization.transaction;
  const issueKey = `${code}:categorization:${categorization.id}`;
  const missingRate = code === "VAT_RATE_MISSING";
  const defaultNature = categorization.vatOperationNature ?? (transaction.type === "CREDIT" ? "DOMESTIC_SALE" : "DOMESTIC_PURCHASE");
  const taxable = isTaxableVatNature(defaultNature);
  return {
    issueKey,
    code,
    severity: missingRate ? "blocking" : "warning",
    title: missingRate ? "Taux TVA manquant" : "Nature TVA manquante",
    detail: missingRate
      ? `${transaction.label} porte une nature ${vatNatureLabel(defaultNature)} sans taux TVA.`
      : `${transaction.label} porte le taux ${vatRateLabel(categorization.vatRate?.toString() ?? null)} sans nature TVA.`,
    actionLabel: missingRate ? "Choisir le taux" : "Choisir la nature",
    href: `/tva/revue?issue=${encodeURIComponent(issueKey)}`,
    transaction: {
      id: transaction.id,
      label: transaction.label,
      date: transaction.date.toISOString().slice(0, 10),
      amount: transaction.amount.toString(),
      accountDebit: categorization.accountDebit ?? (transaction.type === "CREDIT" ? "5121" : "471"),
      accountCredit: categorization.accountCredit ?? (transaction.type === "CREDIT" ? "471" : "5121"),
      ecritureLabel: categorization.ecritureLabel ?? transaction.label,
      vatRate: categorization.vatRate?.toString() ?? (taxable ? null : "0"),
      vatOperationNature: categorization.vatOperationNature ?? null,
    },
  };
}

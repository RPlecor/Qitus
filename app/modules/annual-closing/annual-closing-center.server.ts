import { DocumentType, FiscalYearStatus, Prisma, type AnnualClosingRunStatus, type AnnualClosingStepStatus } from "@prisma/client";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { ExpectedRouteError } from "../route-errors.server";
import { ActivityLogCenter } from "../activity-log/activity-log-center.server";
import { JournalAuditCenter } from "../journal/journal-audit-center.server";
import { JournalExplorer } from "../journal/journal-explorer.server";
import { ClosingAdjustmentCenter } from "../closing-adjustments/closing-adjustment-center.server";
import { ClosingWorkpaperCenter } from "../closing-workpapers/closing-workpaper-center.server";
import { DocumentCatalog } from "../documents/document-catalog.server";
import { DocumentFreshnessCenter } from "../documents/document-freshness-center.server";
import { DocumentGenerationCenter } from "../documents/document-generation-center.server";
import { DocumentEvidenceBundle } from "../documents/document-evidence-bundle.server";
import { FixedAssetRegister } from "../fixed-assets/fixed-asset-register.server";
import { BankLineReconciliationCenter } from "../reconciliations/bank-line-reconciliation-center.server";
import { ReconciliationFreshnessCenter } from "../reconciliations/reconciliation-freshness-center.server";
import { ThirdPartyMatchingCenter } from "../reconciliations/third-party-matching-center.server";
import { TaxPackageDraftCenter } from "../tax-package/tax-package-draft-center.server";
import { VatControlCenter } from "../vat/vat-control-center.server";
import { CLOSING_STEP_CATALOG, getClosingStepDefinition, type ClosingStepCode } from "./closing-step-catalog.server";

export type ClosingIssue = {
  code: string;
  label: string;
  detail: string;
  href: string;
};

export type AnnualClosingStepView = {
  code: ClosingStepCode;
  index: number;
  title: string;
  detail: string;
  status: AnnualClosingStepStatus;
  blockingCount: number;
  warningCount: number;
  blockers: ClosingIssue[];
  warnings: ClosingIssue[];
  evidence: Array<{ label: string; value: string; href?: string }>;
  action: { label: string; href: string };
  skippable: boolean;
  completedAt: string | null;
};

export type AnnualClosingOverview = {
  run: {
    id: string | null;
    status: AnnualClosingRunStatus | "NOT_STARTED";
    startedAt: string | null;
    closedAt: string | null;
    reopenedAt: string | null;
  };
  fiscalYearStatus: string;
  steps: AnnualClosingStepView[];
  canClose: boolean;
  blockers: ClosingIssue[];
  warnings: ClosingIssue[];
};

export class AnnualClosingCenter {
  constructor(
    private readonly journalAudit = new JournalAuditCenter(),
    private readonly journal = new JournalExplorer(),
    private readonly closingAdjustments = new ClosingAdjustmentCenter(),
    private readonly closingWorkpapers = new ClosingWorkpaperCenter(),
    private readonly documents = new DocumentCatalog(),
    private readonly freshness = new DocumentFreshnessCenter(),
    private readonly documentGeneration = new DocumentGenerationCenter(),
    private readonly evidenceBundle = new DocumentEvidenceBundle(),
    private readonly fixedAssets = new FixedAssetRegister(),
    private readonly bankReconciliation = new BankLineReconciliationCenter(),
    private readonly reconciliationFreshness = new ReconciliationFreshnessCenter(),
    private readonly thirdPartyMatching = new ThirdPartyMatchingCenter(),
    private readonly taxPackage = new TaxPackageDraftCenter(),
    private readonly vatControls = new VatControlCenter(),
    private readonly activity = new ActivityLogCenter()
  ) {}

  async getClosingOverview(workspace: CompanyWorkspace): Promise<AnnualClosingOverview> {
    const run = await this.findRun(workspace);
    const steps = await Promise.all(CLOSING_STEP_CATALOG.map((definition) => this.evaluateStep(workspace, definition.code, run?.steps.find((step) => step.code === definition.code))));
    const blockers = steps.flatMap((step) => step.blockers);
    const warnings = steps.flatMap((step) => step.warnings);
    const canClose = run?.status !== "CLOSED" && blockers.length === 0 && steps.every((step) => step.status === "DONE" || step.status === "SKIPPED");
    return {
      run: {
        id: run?.id ?? null,
        status: run?.status ?? "NOT_STARTED",
        startedAt: run?.startedAt?.toISOString() ?? null,
        closedAt: run?.closedAt?.toISOString() ?? null,
        reopenedAt: run?.reopenedAt?.toISOString() ?? null,
      },
      fiscalYearStatus: workspace.fiscalYear.status,
      steps,
      canClose,
      blockers,
      warnings,
    };
  }

  async startClosing(workspace: CompanyWorkspace) {
    const run = await prisma.annualClosingRun.upsert({
      where: { fiscalYearId: workspace.fiscalYear.id },
      create: {
        fiscalYearId: workspace.fiscalYear.id,
        status: "IN_PROGRESS",
        startedAt: new Date(),
        steps: { create: CLOSING_STEP_CATALOG.map((step) => ({ code: step.code })) },
      },
      update: {
        status: "IN_PROGRESS",
        startedAt: new Date(),
        closedAt: null,
      },
      include: { steps: true },
    });
    await prisma.fiscalYear.update({ where: { id: workspace.fiscalYear.id }, data: { status: FiscalYearStatus.CLOSING } });
    await this.ensureSteps(run.id);
    await this.activity.recordActivity(workspace, {
      action: "annual_closing.started",
      entityType: "annual_closing",
      entityId: run.id,
      metadata: { fiscalYearId: workspace.fiscalYear.id },
    });
    return this.getClosingOverview(await refreshWorkspace(workspace));
  }

  async getStep(workspace: CompanyWorkspace, stepCode: string) {
    const code = assertStepCode(stepCode);
    const run = await this.getOrCreateRun(workspace);
    return this.evaluateStep(workspace, code, run.steps.find((step) => step.code === code));
  }

  async runStep(workspace: CompanyWorkspace, stepCode: string, input: Record<string, unknown> = {}) {
    const code = assertStepCode(stepCode);
    if (code === "BANK_RECONCILIATION" && input.statementBalance !== undefined) {
      await this.bankReconciliation.saveStatementBalances(workspace, {
        statementBalance: String(input.statementBalance),
        statementDate: typeof input.statementDate === "string" ? input.statementDate : undefined,
        confirm: true,
      });
    }
    if (code === "FINANCIAL_STATEMENTS") {
      await this.documentGeneration.generateDocuments(workspace, { types: ["statements"] });
    }
    if (code === "TAX_PACKAGE") {
      await this.taxPackage.generateTaxPackageDraft(workspace);
    }
    if (code === "EXPORT_ARCHIVE") {
      const docs = await this.documents.listDocuments(workspace);
      if (!docs.some((document) => document.type === DocumentType.FEC)) {
        await this.documentGeneration.generateDocuments(workspace, { types: ["fec"] });
      }
      await this.evidenceBundle.persistEvidenceBundle(workspace);
    }

    const step = await this.getStep(workspace, code);
    const status: AnnualClosingStepStatus = step.blockingCount > 0 ? "BLOCKED" : "DONE";
    const run = await this.getOrCreateRun(workspace);
    await prisma.annualClosingStep.update({
      where: { closingRunId_code: { closingRunId: run.id, code } },
      data: {
        status,
        blockingCount: step.blockingCount,
        warningCount: step.warningCount,
        resultJson: serializeStep(step),
        completedAt: status === "DONE" ? new Date() : null,
      },
    });
    await this.activity.recordActivity(workspace, {
      action: status === "DONE" ? "annual_closing.step_completed" : "annual_closing.step_blocked",
      entityType: "annual_closing_step",
      entityId: code,
      metadata: { code, title: step.title, blockingCount: step.blockingCount, warningCount: step.warningCount },
    });
    return this.getStep(workspace, code);
  }

  async completeStep(workspace: CompanyWorkspace, stepCode: string) {
    const step = await this.getStep(workspace, stepCode);
    if (step.blockingCount > 0) throw new ExpectedRouteError("Cette étape contient encore des blocages.", 409);
    const run = await this.getOrCreateRun(workspace);
    await prisma.annualClosingStep.update({
      where: { closingRunId_code: { closingRunId: run.id, code: step.code } },
      data: { status: "DONE", completedAt: new Date(), blockingCount: 0, warningCount: step.warningCount, resultJson: serializeStep(step) },
    });
    return this.getStep(workspace, step.code);
  }

  async reopenStep(workspace: CompanyWorkspace, stepCode: string, reason: string) {
    const code = assertStepCode(stepCode);
    const run = await this.getOrCreateRun(workspace);
    await prisma.annualClosingStep.update({
      where: { closingRunId_code: { closingRunId: run.id, code } },
      data: { status: "PENDING", completedAt: null },
    });
    await this.activity.recordActivity(workspace, {
      action: "annual_closing.step_reopened",
      entityType: "annual_closing_step",
      entityId: code,
      metadata: { reason },
    });
    return this.getStep(workspace, code);
  }

  async assertCanCloseFiscalYear(workspace: CompanyWorkspace) {
    const overview = await this.getClosingOverview(workspace);
    const audit = await this.journalAudit.assertJournalIsExportable(workspace);
    const freshness = await this.freshness.getFreshness(workspace);
    const documents = await this.documents.listDocuments(workspace);
    const hasFec = documents.some((document) => document.type === DocumentType.FEC);
    const hasEvidence = documents.some((document) => document.type === DocumentType.EVIDENCE_BUNDLE);
    const hasStructuredTaxPackage = documents.some((document) => document.type === DocumentType.LIASSE_FISCALE && document.format !== "pdf");
    const incomplete = overview.steps.filter((step) => step.status !== "DONE" && step.status !== "SKIPPED");
    const blockers = [
      ...overview.blockers,
      ...incomplete.map((step) => blocker("STEP_INCOMPLETE", `${step.index}. ${step.title}`, "Étape non terminée.", `/cloture/${step.code}`)),
      ...(freshness.staleCount > 0 ? [blocker("STALE_DOCUMENTS", "Documents à régénérer", "Des documents finaux sont obsolètes.", "/documents")] : []),
      ...(!hasFec ? [blocker("MISSING_FEC", "FEC absent", "Le FEC officiel doit être généré.", "/documents")] : []),
      ...(!hasStructuredTaxPackage ? [blocker("MISSING_TAX_PACKAGE", "Liasse structurée absente", "La liasse fiscale structurée doit être générée.", "/documents")] : []),
      ...(!hasEvidence ? [blocker("MISSING_EVIDENCE", "Paquet de preuve absent", "Le paquet de preuve final doit être généré.", "/cloture/archive")] : []),
    ];
    if (blockers.length > 0) throw new ExpectedRouteError(`Clôture impossible : ${blockers[0].label}.`, 409);
    return { overview, audit };
  }

  async closeFiscalYear(workspace: CompanyWorkspace) {
    const { overview } = await this.assertCanCloseFiscalYear(workspace);
    const manifest = await this.evidenceBundle.getBundleManifest(workspace);
    const run = await this.getOrCreateRun(workspace);
    await prisma.$transaction([
      prisma.annualClosingRun.update({
        where: { id: run.id },
        data: {
          status: "CLOSED",
          closedAt: new Date(),
          closedByUserId: workspace.user.id,
          evidenceManifestJson: manifest as unknown as Prisma.InputJsonValue,
        },
      }),
      prisma.fiscalYear.update({ where: { id: workspace.fiscalYear.id }, data: { status: FiscalYearStatus.CLOSED } }),
    ]);
    await this.activity.recordActivity(workspace, {
      action: "annual_closing.closed",
      entityType: "annual_closing",
      entityId: run.id,
      metadata: { steps: overview.steps.length, documentCount: manifest.documents.length },
    });
    return this.getClosingOverview(await refreshWorkspace(workspace));
  }

  async reopenFiscalYear(workspace: CompanyWorkspace, reason: string) {
    const run = await this.getOrCreateRun(workspace);
    await prisma.$transaction([
      prisma.annualClosingRun.update({
        where: { id: run.id },
        data: { status: "REOPENED", reopenedAt: new Date(), reopenedByUserId: workspace.user.id },
      }),
      prisma.fiscalYear.update({ where: { id: workspace.fiscalYear.id }, data: { status: FiscalYearStatus.CLOSING } }),
    ]);
    await this.activity.recordActivity(workspace, {
      action: "annual_closing.reopened",
      entityType: "annual_closing",
      entityId: run.id,
      metadata: { reason },
    });
    return this.getClosingOverview(await refreshWorkspace(workspace));
  }

  private async evaluateStep(workspace: CompanyWorkspace, code: ClosingStepCode, stored?: { status: AnnualClosingStepStatus; completedAt: Date | null; resultJson: unknown } | null): Promise<AnnualClosingStepView> {
    const definition = getClosingStepDefinition(code);
    const evaluated = await this.evaluateStepBody(workspace, code);
    const liveStatus: AnnualClosingStepStatus = evaluated.blockers.length > 0 ? "BLOCKED" : "READY";
    const status = stored?.status === "DONE" || stored?.status === "SKIPPED" ? stored.status : liveStatus;
    return {
      code,
      index: definition.index,
      title: definition.title,
      detail: definition.detail,
      status,
      blockingCount: evaluated.blockers.length,
      warningCount: evaluated.warnings.length,
      blockers: evaluated.blockers,
      warnings: evaluated.warnings,
      evidence: evaluated.evidence,
      action: { label: definition.actionLabel, href: definition.actionHref },
      skippable: definition.skippable,
      completedAt: stored?.completedAt?.toISOString() ?? null,
    };
  }

  private async evaluateStepBody(workspace: CompanyWorkspace, code: ClosingStepCode): Promise<{ blockers: ClosingIssue[]; warnings: ClosingIssue[]; evidence: Array<{ label: string; value: string; href?: string }> }> {
    if (code === "BALANCE_CHECK") {
      const audit = await this.journalAudit.getAuditSummary(workspace);
      return {
        blockers: audit.status === "exportable" ? [] : audit.issues.filter((issue) => issue.severity === "blocking").map((issue) => blocker(issue.code, issue.label, issue.detail, "/ecritures")),
        warnings: audit.issues.filter((issue) => issue.severity === "warning").map((issue) => warning(issue.code, issue.label, issue.detail, "/ecritures")),
        evidence: [{ label: audit.label, value: `${audit.summary.entriesCount} écritures · ${audit.summary.linesCount} lignes`, href: "/ecritures" }],
      };
    }
    if (code === "BANK_RECONCILIATION") {
      const [reconciliation, freshness] = await Promise.all([
        this.bankReconciliation.getBankReconciliation(workspace),
        this.reconciliationFreshness.getRunFreshness(workspace, "BANK"),
      ]);
      const blockers = [
        ...(freshness.status !== "fresh" ? [blocker("BANK_RECONCILIATION_STALE", "Rapprochement bancaire à relancer", freshness.staleReasons[0] ?? "Relance le rapprochement bancaire ligne à ligne.", "/rapprochements/banque")] : []),
        ...(reconciliation.summary.status === "COMPLETED" && reconciliation.balance.status === "MATCHED" && reconciliation.balance.confirmedAt ? [] : [blocker("BANK_NOT_CONFIRMED", "Rapprochement bancaire non confirmé", "Lance le rapprochement ligne à ligne puis confirme le solde du relevé bancaire.", "/rapprochements/banque")]),
      ];
      return {
        blockers,
        warnings: reconciliation.balance.status === "DIFFERENCE" ? [warning("BANK_DIFFERENCE", "Écart bancaire", `Écart de ${formatEuro(reconciliation.balance.difference ?? 0)}.`, "/rapprochements/banque")] : [],
        evidence: [{ label: "Ligne à ligne", value: `${reconciliation.summary.matched} matché(s) · ${reconciliation.summary.openIssues} issue(s)`, href: "/rapprochements/banque" }, { label: "Solde comptable", value: formatEuro(reconciliation.balance.ledgerBalance) }, { label: "Solde relevé", value: reconciliation.balance.statementBalance == null ? "Non saisi" : formatEuro(reconciliation.balance.statementBalance) }],
      };
    }
    if (code === "THIRD_PARTY_MATCHING") {
      const [summary, freshness] = await Promise.all([
        this.thirdPartyMatching.summarizeThirdPartyMatching(workspace),
        this.reconciliationFreshness.getRunFreshness(workspace, "THIRD_PARTY"),
      ]);
      return {
        blockers: [
          ...(summary.openIssues > 0 ? [blocker("THIRD_PARTY_OPEN_ITEMS", "Lettrage tiers incomplet", `${summary.openIssues} point(s) tiers restent ouverts.`, "/rapprochements/tiers")] : []),
          ...(freshness.status === "stale" ? [blocker("THIRD_PARTY_STALE", "Lettrage tiers à relancer", freshness.staleReasons[0] ?? "Relance le lettrage tiers.", "/rapprochements/tiers")] : []),
        ],
        warnings: summary.status === "MISSING" ? [warning("THIRD_PARTY_NOT_RUN", "Lettrage tiers non lancé", "Lance le lettrage tiers pour documenter l'étape.", "/rapprochements/tiers")] : [],
        evidence: [{ label: "Lettrage tiers", value: `${summary.matched} matché(s) · ${summary.openIssues} ouvert(s)`, href: "/rapprochements/tiers" }],
      };
    }
    if (code === "PREPAID_ACCRUALS" || code === "DEPRECIATION" || code === "TAX_CALCULATION" || code === "CLOSING_ADJUSTMENTS") {
      const [proposals, workpapers] = await Promise.all([
        this.closingAdjustments.listProposals(workspace),
        this.closingWorkpapers.summarizeWorkpapers(workspace),
      ]);
      const relevant = proposals.filter((proposal) => (
        code === "PREPAID_ACCRUALS" ? ["CCA", "PCA", "FNP", "FAE"].includes(proposal.kind) :
        code === "DEPRECIATION" ? proposal.kind === "DEPRECIATION" :
        code === "TAX_CALCULATION" ? proposal.kind === "CORPORATE_TAX" :
        true
      ));
      const drafts = relevant.filter((proposal) => proposal.status === "DRAFT").length;
      return {
        blockers: code === "CLOSING_ADJUSTMENTS" && workpapers.requiredEvidenceMissing > 0
          ? [blocker("CLOSING_EVIDENCE_MISSING", "Pièces de clôture manquantes", `${workpapers.requiredEvidenceMissing} proposition(s) OD requièrent une pièce.`, "/cloture/od")]
          : [],
        warnings: [
          ...(drafts > 0 ? [warning("DRAFT_OD", "OD à relire", `${drafts} proposition(s) à valider ou rejeter.`, "/cloture/od")] : []),
          ...(workpapers.draft > 0 ? [warning("DRAFT_WORKPAPER", "Workpapers incomplets", `${workpapers.draft} workpaper(s) restent en brouillon.`, "/cloture/od")] : []),
        ],
        evidence: [
          { label: "OD validées", value: String(relevant.filter((proposal) => proposal.status === "APPROVED").length), href: "/cloture/od" },
          { label: "Workpapers", value: `${workpapers.ready} prêt(s) · ${workpapers.draft} brouillon(s)`, href: "/cloture/od" },
        ],
      };
    }
    if (code === "PROVISIONS") {
      const proposals = await this.closingAdjustments.listProposals(workspace);
      const relevant = proposals.filter((proposal) => proposal.kind === "PROVISION" || proposal.kind === "PROVISION_REVERSAL");
      const drafts = relevant.filter((proposal) => proposal.status === "DRAFT").length;
      return {
        blockers: [],
        warnings: drafts > 0 ? [warning("PROVISION_DRAFT_OD", "Provisions à valider", `${drafts} proposition(s) de provision restent à valider ou rejeter.`, "/cloture/od")] : [],
        evidence: [{ label: "Provisions validées", value: String(relevant.filter((proposal) => proposal.status === "APPROVED").length), href: "/cloture/od" }],
      };
    }
    if (code === "VAT_REVIEW") {
      const review = await this.vatControls.getVatReview(workspace);
      return {
        blockers: review.controls.filter((control) => control.severity === "blocking").map((control) => blocker(control.code, control.title, control.detail, control.href)),
        warnings: review.controls.filter((control) => control.severity !== "blocking").map((control) => warning(control.code, control.title, control.detail, control.href)),
        evidence: [{ label: "Régime TVA", value: workspace.company.vatRegime, href: "/tva" }, { label: "Contrôles TVA", value: String(review.controls.length), href: "/tva" }],
      };
    }
    if (code === "FINANCIAL_STATEMENTS") {
      const docs = await this.documents.listDocuments(workspace);
      const required = [DocumentType.BALANCE, DocumentType.BILAN, DocumentType.COMPTE_RESULTAT];
      const missing = required.filter((type) => !docs.some((doc) => doc.type === type));
      return {
        blockers: missing.map((type) => blocker("MISSING_STATEMENT", String(type), "État financier manquant.", "/documents")),
        warnings: [],
        evidence: [{ label: "États générés", value: `${required.length - missing.length}/3`, href: "/documents" }],
      };
    }
    if (code === "TAX_PACKAGE") {
      const taxPackage = await this.taxPackage.getTaxPackageSummary(workspace);
      return {
        blockers: taxPackage.status === "ready" ? [] : [blocker("MISSING_TAX_PACKAGE", "Liasse fiscale brouillon absente", "Génère le brouillon de liasse.", "/cloture/TAX_PACKAGE")],
        warnings: [],
        evidence: [{ label: "Liasse", value: taxPackage.status === "ready" ? taxPackage.filename : "Non générée" }],
      };
    }
    const docs = await this.documents.listDocuments(workspace);
    const hasFec = docs.some((doc) => doc.type === DocumentType.FEC);
    const hasEvidence = docs.some((doc) => doc.type === DocumentType.EVIDENCE_BUNDLE);
    return {
      blockers: [
        ...(!hasFec ? [blocker("MISSING_FEC", "FEC absent", "Génère le FEC officiel.", "/documents")] : []),
        ...(!hasEvidence ? [blocker("MISSING_EVIDENCE", "Paquet de preuve absent", "Génère le paquet de preuve final.", "/cloture/archive")] : []),
      ],
      warnings: [],
      evidence: [{ label: "FEC", value: hasFec ? "Présent" : "Absent" }, { label: "Preuve", value: hasEvidence ? "Présente" : "Absente" }],
    };
  }

  private async findRun(workspace: CompanyWorkspace) {
    return prisma.annualClosingRun.findUnique({
      where: { fiscalYearId: workspace.fiscalYear.id },
      include: { steps: true },
    });
  }

  private async getOrCreateRun(workspace: CompanyWorkspace) {
    const existing = await this.findRun(workspace);
    if (existing) {
      await this.ensureSteps(existing.id);
      return this.findRun(workspace).then((run) => run!);
    }
    await this.startClosing(workspace);
    return this.findRun(workspace).then((run) => run!);
  }

  private async ensureSteps(runId: string) {
    await Promise.all(CLOSING_STEP_CATALOG.map((step) => prisma.annualClosingStep.upsert({
      where: { closingRunId_code: { closingRunId: runId, code: step.code } },
      create: { closingRunId: runId, code: step.code },
      update: {},
    })));
  }
}

export async function assertFiscalYearMutable(workspace: CompanyWorkspace) {
  const fiscalYear = await prisma.fiscalYear.findUniqueOrThrow({ where: { id: workspace.fiscalYear.id }, select: { status: true } });
  if (fiscalYear.status === FiscalYearStatus.CLOSED) {
    throw new ExpectedRouteError("L'exercice est clôturé. Réouvre-le avant de modifier les données.", 409);
  }
}

function assertStepCode(code: string): ClosingStepCode {
  if (!CLOSING_STEP_CATALOG.some((step) => step.code === code)) throw new ExpectedRouteError("Étape de clôture inconnue.", 404);
  return code as ClosingStepCode;
}

function blocker(code: string, label: string, detail: string, href: string): ClosingIssue {
  return { code, label, detail, href };
}

function warning(code: string, label: string, detail: string, href: string): ClosingIssue {
  return { code, label, detail, href };
}

function serializeStep(step: AnnualClosingStepView) {
  return {
    code: step.code,
    title: step.title,
    status: step.status,
    blockingCount: step.blockingCount,
    warningCount: step.warningCount,
    blockers: step.blockers,
    warnings: step.warnings,
    evidence: step.evidence,
  } as unknown as Prisma.InputJsonValue;
}

async function refreshWorkspace(workspace: CompanyWorkspace): Promise<CompanyWorkspace> {
  const fiscalYear = await prisma.fiscalYear.findUniqueOrThrow({ where: { id: workspace.fiscalYear.id } });
  return { ...workspace, fiscalYear };
}

function formatEuro(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}

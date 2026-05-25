import { DocumentType } from "@prisma/client";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { AccountingCoverageCenter } from "../accounting-coverage/accounting-coverage-center.server";
import { EvidenceRequirementCenter } from "../accounting-coverage/evidence-requirement-center.server";
import { AnnualClosingCenter } from "../annual-closing/annual-closing-center.server";
import { prisma } from "../db.server";
import { DocumentCatalog } from "../documents/document-catalog.server";
import { entriesWithoutEvidenceLabel } from "../evidence/evidence-wording";
import { JournalAuditCenter } from "../journal/journal-audit-center.server";
import { ExpectedRouteError } from "../route-errors.server";
import { VatControlCenter } from "../vat/vat-control-center.server";
import { ReconciliationReviewWorkflow } from "../reconciliations/reconciliation-review-workflow.server";
import { FecPrecheckCenter } from "./fec-precheck-center.server";
import { TaxPackageCompletionCenter } from "./tax-package-completion-center.server";

export type ExpertDossierSectionStatus = "ready" | "partial" | "blocked" | "stale" | "not_applicable";
export type ExpertDossierRisk = "low" | "medium" | "high";

export type ExpertDossierSection = {
  code: string;
  title: string;
  status: ExpertDossierSectionStatus;
  risk: ExpertDossierRisk;
  summary: string;
  evidence: string[];
  gaps: string[];
  href: string;
};

export type ExpertDossierReadiness = {
  status: "ready_for_review" | "ready_for_final_export" | "partial" | "blocked";
  label: string;
  score: number;
  ready: number;
  partial: number;
  blocked: number;
  stale: number;
  highRisk: number;
};

export type ExpertDossierOverview = {
  generatedAt: string;
  company: { id: string; name: string };
  fiscalYear: { id: string; startDate: string; endDate: string; status: string };
  readiness: ExpertDossierReadiness;
  sections: ExpertDossierSection[];
};

export type ExpertReviewStats = {
  runs: number;
  openItems: number;
  openBlockingItems: number;
  signedOff: number;
};

export type ExpertReviewStatsReader = {
  getReviewStats(workspace: CompanyWorkspace): Promise<ExpertReviewStats>;
};

class PrismaExpertReviewStatsReader implements ExpertReviewStatsReader {
  async getReviewStats(workspace: CompanyWorkspace): Promise<ExpertReviewStats> {
    const [runs, openItems, openBlockingItems, signedOff] = await Promise.all([
      prisma.expertReviewRun.count({ where: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id } }),
      prisma.expertReviewItem.count({ where: { reviewRun: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id }, status: { in: ["OPEN", "ANSWERED"] } } }),
      prisma.expertReviewItem.count({ where: { reviewRun: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id }, status: { in: ["OPEN", "ANSWERED"] }, severity: "BLOCKING" } }),
      prisma.expertReviewRun.count({ where: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id, status: "SIGNED_OFF" } }),
    ]);
    return { runs, openItems, openBlockingItems, signedOff };
  }
}

export class ExpertDossierCenter {
  constructor(
    private readonly coverage = new AccountingCoverageCenter(),
    private readonly documents = new DocumentCatalog(),
    private readonly fec = new FecPrecheckCenter(),
    private readonly taxPackage = new TaxPackageCompletionCenter(),
    private readonly journalAudit = new JournalAuditCenter(),
    private readonly evidence = new EvidenceRequirementCenter(),
    private readonly vat = new VatControlCenter(),
    private readonly reconciliations = new ReconciliationReviewWorkflow(),
    private readonly closing = new AnnualClosingCenter(),
    private readonly reviewStats = new PrismaExpertReviewStatsReader()
  ) {}

  async getDossierOverview(workspace: CompanyWorkspace): Promise<ExpertDossierOverview> {
    const sections = await this.listDossierSections(workspace);
    return {
      generatedAt: new Date().toISOString(),
      company: { id: workspace.company.id, name: workspace.company.name },
      fiscalYear: {
        id: workspace.fiscalYear.id,
        startDate: workspace.fiscalYear.startDate.toISOString(),
        endDate: workspace.fiscalYear.endDate.toISOString(),
        status: workspace.fiscalYear.status,
      },
      readiness: buildReadiness(sections, workspace.fiscalYear.status),
      sections,
    };
  }

  async getReadiness(workspace: CompanyWorkspace) {
    return (await this.getDossierOverview(workspace)).readiness;
  }

  async listDossierSections(workspace: CompanyWorkspace): Promise<ExpertDossierSection[]> {
    const [coverage, documents, fec, taxPackage, journal, evidence, vat, reconciliations, closing, reviewStats, activityCount] = await Promise.all([
      this.coverage.getCoverageOverview(workspace),
      this.documents.listDocuments(workspace),
      this.fec.getFecPrecheck(workspace),
      this.taxPackage.getTaxPackageCompletion(workspace),
      this.journalAudit.getAuditSummary(workspace),
      this.evidence.summarizeEvidenceGaps(workspace),
      this.vat.getVatReview(workspace),
      this.reconciliations.summarizeReconciliationReadiness(workspace),
      this.closing.getClosingOverview(workspace),
      this.reviewStats.getReviewStats(workspace),
      prisma.activityLog.count({ where: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id } }),
    ]);
    const statementsReady = ["BALANCE", "BILAN", "COMPTE_RESULTAT"].every((type) => documents.some((document) => document.type === type));
    const staleDocuments = documents.filter((document) => document.freshness?.isStale).length;
    return [
      section("fec", "FEC", fec.status === "ready" ? "ready" : fec.status === "warning" ? "partial" : "blocked", fec.blockingCount > 0 ? "high" : fec.warningCount > 0 ? "medium" : "low", fec.label, fec.fec ? [`${fec.fec.filename}`] : [], fec.issues.map((issue) => issue.label), "/documents"),
      section("journal", "Journal audit", journal.status === "exportable" ? "ready" : "blocked", journal.blockingCount > 0 ? "high" : "medium", journal.label, [`${journal.summary.entriesCount} écriture(s)`, `${journal.summary.linesCount} ligne(s)`], journal.issues.map((issue) => issue.label), "/ecritures"),
      section("tax_package", "Liasse fiscale CERFA", taxPackage.status === "ready" ? "ready" : taxPackage.status === "warning" ? "partial" : "blocked", taxPackage.status === "blocked" ? "high" : taxPackage.status === "warning" ? "medium" : "low", taxPackage.label, taxPackage.sourceFilename ? [taxPackage.sourceFilename] : [], [...taxPackage.missingSections, ...taxPackage.warnings], "/documents"),
      section("statements", "États financiers", statementsReady && staleDocuments === 0 ? "ready" : documents.length > 0 ? "partial" : "blocked", statementsReady ? "low" : "high", statementsReady ? "Balance, bilan et compte de résultat présents" : "États financiers incomplets", documents.filter((document) => ["BALANCE", "BILAN", "COMPTE_RESULTAT"].includes(document.type)).map((document) => document.filename), statementsReady ? [] : ["Balance, bilan ou compte de résultat manquant"], "/documents"),
      section("vat", "TVA", vat.status === "not_applicable" ? "not_applicable" : vat.status === "ready" ? "ready" : vat.blockingCount > 0 ? "blocked" : "partial", vat.blockingCount > 0 ? "high" : vat.warningCount > 0 ? "medium" : "low", vat.status === "not_applicable" ? "TVA non applicable" : `${vat.controls.length} contrôle(s) TVA`, [], vat.controls.map((control) => control.title), "/tva"),
      section("evidence", "Justificatifs", evidence.missing > 0 ? "partial" : "ready", evidence.missing > 0 ? "medium" : "low", `${evidence.satisfied}/${evidence.total} preuve(s) satisfaite(s)`, [`${evidence.satisfied} preuve(s)`], evidence.missing > 0 ? [entriesWithoutEvidenceLabel(evidence.missing)] : [], "/couverture/evidence"),
      section("reconciliations", "Rapprochements", reconciliations.status === "ready" ? "ready" : reconciliations.issues.blocking > 0 ? "blocked" : "partial", reconciliations.issues.blocking > 0 ? "high" : reconciliations.issues.warning > 0 ? "medium" : "low", `${reconciliations.issues.open} issue(s) ouverte(s)`, [`Progression banque ${reconciliations.bank.progress}%`], reconciliations.issues.open > 0 ? [`${reconciliations.issues.open} issue(s) à traiter`] : [], "/rapprochements"),
      section("closing", "Clôture annuelle", closing.run.status === "CLOSED" ? "ready" : closing.blockers.length > 0 ? "blocked" : "partial", closing.blockers.length > 0 ? "high" : closing.run.status === "CLOSED" ? "low" : "medium", closing.run.status === "CLOSED" ? "Exercice clôturé" : `${closing.blockers.length} blocage(s), ${closing.warnings.length} avertissement(s)`, [`${closing.steps.filter((step) => step.status === "DONE" || step.status === "SKIPPED").length}/12 étape(s)`], closing.blockers.map((blocker) => blocker.label), "/cloture"),
      section("coverage", "Couverture EC", coverage.status === "beta_ready" ? "ready" : coverage.status === "blocked" ? "blocked" : "partial", coverage.highRisk > 0 ? "high" : coverage.status === "beta_ready" ? "low" : "medium", coverage.label, [`Score ${coverage.score}%`], coverage.areas.filter((area) => area.risk === "high" && area.status !== "covered").map((area) => area.title), "/couverture"),
      section("activity", "Activité et audit", activityCount > 0 ? "ready" : "partial", activityCount > 0 ? "low" : "medium", `${activityCount} événement(s) d'activité`, [`${activityCount} trace(s)`], activityCount > 0 ? [] : ["Journal d'activité peu renseigné"], "/activity"),
      section("expert_review", "Revue expert-comptable", reviewStats.signedOff > 0 ? "ready" : reviewStats.openItems > 0 ? "partial" : reviewStats.runs > 0 ? "partial" : "blocked", reviewStats.openBlockingItems > 0 || reviewStats.signedOff === 0 ? "high" : "low", reviewStats.signedOff > 0 ? "Validation finale EC présente" : `${reviewStats.openItems} demande(s) ouverte(s)`, reviewStats.runs > 0 ? [`${reviewStats.runs} revue(s)`] : [], reviewStats.signedOff > 0 ? [] : ["Validation finale EC absente"], "/dossier-ec/revue"),
    ];
  }

  async getSectionDetail(workspace: CompanyWorkspace, sectionCode: string) {
    const section = (await this.listDossierSections(workspace)).find((candidate) => candidate.code === sectionCode);
    if (!section) throw new ExpectedRouteError("Section dossier EC introuvable.", 404);
    return section;
  }

  async assertReadyForExpertReview(workspace: CompanyWorkspace) {
    const overview = await this.getDossierOverview(workspace);
    if (overview.readiness.status === "blocked") throw new ExpectedRouteError("Le dossier contient encore des blocages avant revue expert-comptable.", 409);
    return overview;
  }

  async assertReadyForFinalExport(workspace: CompanyWorkspace) {
    const overview = await this.getDossierOverview(workspace);
    if (overview.readiness.status !== "ready_for_final_export") {
      throw new ExpectedRouteError("Le dossier final n'est pas exportable : clôture, FEC, liasse ou validation EC manquants.", 409);
    }
    return overview;
  }

}

function section(code: string, title: string, status: ExpertDossierSectionStatus, risk: ExpertDossierRisk, summary: string, evidence: string[], gaps: string[], href: string): ExpertDossierSection {
  return { code, title, status, risk, summary, evidence, gaps, href };
}

function buildReadiness(sections: ExpertDossierSection[], fiscalYearStatus: string): ExpertDossierReadiness {
  const scored = sections.filter((section) => section.status !== "not_applicable");
  const ready = sections.filter((section) => section.status === "ready").length;
  const partial = sections.filter((section) => section.status === "partial").length;
  const blocked = sections.filter((section) => section.status === "blocked").length;
  const stale = sections.filter((section) => section.status === "stale").length;
  const highRisk = sections.filter((section) => section.risk === "high" && section.status !== "ready" && section.status !== "not_applicable").length;
  const score = scored.length === 0 ? 0 : Math.round(scored.reduce((sum, section) => sum + scoreSection(section.status), 0) / scored.length);
  const signedOff = sections.find((section) => section.code === "expert_review")?.status === "ready";
  const status = blocked > 0 || highRisk > 0
    ? "blocked"
    : fiscalYearStatus === "CLOSED" && signedOff
      ? "ready_for_final_export"
      : "ready_for_review";
  return {
    status,
    label: status === "ready_for_final_export" ? "Dossier final exportable" : status === "ready_for_review" ? "Dossier prêt pour revue EC" : status === "blocked" ? "Dossier bloqué" : "Dossier partiel",
    score,
    ready,
    partial,
    blocked,
    stale,
    highRisk,
  };
}

function scoreSection(status: ExpertDossierSectionStatus) {
  if (status === "ready" || status === "not_applicable") return 100;
  if (status === "partial") return 50;
  return 0;
}

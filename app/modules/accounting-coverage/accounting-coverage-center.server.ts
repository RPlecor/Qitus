import type { DocumentType, FiscalYearStatus, VatRegime } from "@prisma/client";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { DocumentFreshnessCenter } from "../documents/document-freshness-center.server";
import { JournalAuditCenter } from "../journal/journal-audit-center.server";
import { ExpectedRouteError } from "../route-errors.server";
import { VatControlCenter, type VatReview } from "../vat/vat-control-center.server";
import { ReconciliationFreshnessCenter } from "../reconciliations/reconciliation-freshness-center.server";
import { ReconciliationReviewWorkflow } from "../reconciliations/reconciliation-review-workflow.server";
import { ClosingAdjustmentFreshnessCenter } from "../closing-adjustments/closing-adjustment-freshness-center.server";
import { ClosingWorkpaperCenter } from "../closing-workpapers/closing-workpaper-center.server";
import { entriesWithoutEvidenceLabel } from "../evidence/evidence-wording";
import { EvidenceRequirementCenter, type EvidenceRequirementSummary } from "./evidence-requirement-center.server";

export type CoverageAreaCode =
  | "transactions"
  | "ledger"
  | "evidence"
  | "vat"
  | "documents"
  | "fec"
  | "tax_package"
  | "reconciliations"
  | "closing"
  | "expert_review"
  | "audit_privacy";

export type CoverageStatus = "covered" | "partial" | "missing" | "not_applicable";
export type CoverageRisk = "low" | "medium" | "high";

export type CoverageArea = {
  code: CoverageAreaCode;
  title: string;
  status: CoverageStatus;
  risk: CoverageRisk;
  summary: string;
  evidence: string[];
  gaps: string[];
  nextPhase: string;
  href: string;
};

export type AccountingCoverageOverview = {
  status: "beta_ready" | "partial" | "blocked";
  score: number;
  label: string;
  covered: number;
  partial: number;
  missing: number;
  highRisk: number;
  areas: CoverageArea[];
  generatedAt: string;
};

export type AccountingCoverageSnapshot = {
  transactionCount: number;
  reviewTransactionCount: number;
  categorizationCount: number;
  journalEntryCount: number;
  journalLineCount: number;
  journalAuditStatus: "exportable" | "needs_attention";
  missingEvidence: EvidenceRequirementSummary;
  attachmentCount: number;
  attachmentLinkCount: number;
  orphanAttachmentCount: number;
  extractionFailureCount: number;
  vatRegime: VatRegime;
  vatLineCount: number;
  vatReview: VatReview;
  documentTypes: DocumentType[];
  staleDocumentCount: number;
  bankReconciliationCount: number;
  matchedBankReconciliationCount: number;
  stripeCandidateCount: number;
  reconciliationStatus?: string;
  reconciliationBlockingCount?: number;
  reconciliationWarningCount?: number;
  reconciliationProgress?: number;
  reconciliationStaleCount?: number;
  closingRunStatus: FiscalYearStatus;
  closingRunCount: number;
  approvedClosingAdjustments: number;
  draftClosingAdjustments: number;
  rejectedClosingAdjustments: number;
  closingWorkpaperCount: number;
  closingWorkpaperDraftCount: number;
  closingRequiredEvidenceMissing: number;
  closingAdjustmentStaleCount?: number;
  shareLinkCount: number;
  expertValidationCount: number;
  activityCount: number;
  privacyRequestCount: number;
};

export class AccountingCoverageCenter {
  constructor(
    private readonly evidence = new EvidenceRequirementCenter(),
    private readonly journalAudit = new JournalAuditCenter(),
    private readonly freshness = new DocumentFreshnessCenter(),
    private readonly vatControls = new VatControlCenter(),
    private readonly reconciliations = new ReconciliationReviewWorkflow(),
    private readonly reconciliationFreshness = new ReconciliationFreshnessCenter(),
    private readonly closingWorkpapers = new ClosingWorkpaperCenter(),
    private readonly closingAdjustmentFreshness = new ClosingAdjustmentFreshnessCenter()
  ) {}

  async getCoverageOverview(workspace: CompanyWorkspace): Promise<AccountingCoverageOverview> {
    return buildCoverageOverview(await this.loadSnapshot(workspace));
  }

  async listCoverageAreas(workspace: CompanyWorkspace): Promise<CoverageArea[]> {
    return (await this.getCoverageOverview(workspace)).areas;
  }

  async getCoverageAreaDetail(workspace: CompanyWorkspace, areaCode: string): Promise<CoverageArea> {
    const area = (await this.listCoverageAreas(workspace)).find((candidate) => candidate.code === areaCode);
    if (!area) throw new ExpectedRouteError("Domaine de couverture introuvable.", 404);
    return area;
  }

  async assertBetaReady(workspace: CompanyWorkspace) {
    const overview = await this.getCoverageOverview(workspace);
    if (overview.status !== "beta_ready") {
      throw new ExpectedRouteError(`Couverture EC insuffisante : ${overview.highRisk} risque(s) élevé(s) restent à traiter.`, 409);
    }
    return overview;
  }

  private async loadSnapshot(workspace: CompanyWorkspace): Promise<AccountingCoverageSnapshot> {
    const [transactionCount, reviewTransactionCount, categorizationCount, journalEntryCount, journalLineCount, audit, evidence, attachmentCount, attachmentLinkCount, orphanAttachmentCount, extractionFailureCount, freshness, documentTypes, bankReconciliations, stripeCandidateCount, reconciliationReadiness, reconciliationFreshness, closingRunCount, approvedClosingAdjustments, draftClosingAdjustments, rejectedClosingAdjustments, closingWorkpapers, closingAdjustmentFreshness, shareLinkCount, expertValidationCount, activityCount, privacyRequestCount, vatReview] = await Promise.all([
      prisma.transaction.count({ where: { fiscalYearId: workspace.fiscalYear.id } }),
      prisma.categorization.count({ where: { fiscalYearId: workspace.fiscalYear.id, status: "NEEDS_REVIEW" } }),
      prisma.categorization.count({ where: { fiscalYearId: workspace.fiscalYear.id } }),
      prisma.journalEntry.count({ where: { fiscalYearId: workspace.fiscalYear.id } }),
      prisma.journalLine.count({ where: { journalEntry: { fiscalYearId: workspace.fiscalYear.id } } }),
      this.journalAudit.getAuditSummary(workspace),
      this.evidence.summarizeEvidenceGaps(workspace),
      prisma.attachment.count({ where: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id, archivedAt: null } }),
      prisma.attachmentLink.count({ where: { attachment: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id, archivedAt: null } } }),
      prisma.attachment.count({ where: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id, archivedAt: null, links: { none: {} } } }),
      prisma.attachment.count({ where: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id, archivedAt: null, status: "EXTRACTION_FAILED" } }),
      this.freshness.getFreshness(workspace),
      prisma.document.findMany({ where: { fiscalYearId: workspace.fiscalYear.id, status: "READY" }, select: { type: true } }),
      prisma.bankReconciliation.findMany({ where: { fiscalYearId: workspace.fiscalYear.id }, select: { status: true } }),
      prisma.transaction.count({
        where: {
          fiscalYearId: workspace.fiscalYear.id,
          OR: [
            { label: { contains: "stripe", mode: "insensitive" } },
            { label: { contains: "payout", mode: "insensitive" } },
            { counterparty: { contains: "stripe", mode: "insensitive" } },
          ],
        },
      }),
      this.reconciliations.summarizeReconciliationReadiness(workspace),
      this.reconciliationFreshness.getFreshness(workspace),
      prisma.annualClosingRun.count({ where: { fiscalYearId: workspace.fiscalYear.id } }),
      prisma.closingAdjustmentProposal.count({ where: { fiscalYearId: workspace.fiscalYear.id, status: "APPROVED" } }),
      prisma.closingAdjustmentProposal.count({ where: { fiscalYearId: workspace.fiscalYear.id, status: "DRAFT" } }),
      prisma.closingAdjustmentProposal.count({ where: { fiscalYearId: workspace.fiscalYear.id, status: "REJECTED" } }),
      this.closingWorkpapers.summarizeWorkpapers(workspace),
      this.closingAdjustmentFreshness.getFreshness(workspace),
      prisma.shareLink.count({ where: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id } }),
      prisma.shareLink.count({ where: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id, reviewedAt: { not: null } } }),
      prisma.activityLog.count({ where: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id } }),
      prisma.privacyRequest.count({ where: { companyId: workspace.company.id } }),
      this.vatControls.getVatReview(workspace),
    ]);
    return {
      transactionCount,
      reviewTransactionCount,
      categorizationCount,
      journalEntryCount,
      journalLineCount,
      journalAuditStatus: audit.status,
      missingEvidence: evidence,
      attachmentCount,
      attachmentLinkCount,
      orphanAttachmentCount,
      extractionFailureCount,
      vatRegime: workspace.company.vatRegime,
      vatLineCount: await prisma.journalLine.count({ where: { journalEntry: { fiscalYearId: workspace.fiscalYear.id }, account: { startsWith: "445" } } }),
      vatReview,
      documentTypes: documentTypes.map((document) => document.type),
      staleDocumentCount: freshness.staleCount,
      bankReconciliationCount: bankReconciliations.length,
      matchedBankReconciliationCount: bankReconciliations.filter((item) => item.status === "MATCHED").length,
      stripeCandidateCount,
      reconciliationStatus: reconciliationReadiness.status,
      reconciliationBlockingCount: reconciliationReadiness.issues.blocking,
      reconciliationWarningCount: reconciliationReadiness.issues.warning,
      reconciliationProgress: Math.round((reconciliationReadiness.bank.progress + reconciliationReadiness.stripe.progress + reconciliationReadiness.thirdParty.progress + reconciliationReadiness.suspense.progress) / 4),
      reconciliationStaleCount: reconciliationFreshness.staleCount,
      closingRunStatus: workspace.fiscalYear.status,
      closingRunCount,
      approvedClosingAdjustments,
      draftClosingAdjustments,
      rejectedClosingAdjustments,
      closingWorkpaperCount: closingWorkpapers.total,
      closingWorkpaperDraftCount: closingWorkpapers.draft,
      closingRequiredEvidenceMissing: closingWorkpapers.requiredEvidenceMissing,
      closingAdjustmentStaleCount: closingAdjustmentFreshness.staleCount,
      shareLinkCount,
      expertValidationCount,
      activityCount,
      privacyRequestCount,
    };
  }
}

export function buildCoverageOverview(snapshot: AccountingCoverageSnapshot): AccountingCoverageOverview {
  const areas = buildCoverageAreas(snapshot);
  const scored = areas.filter((area) => area.status !== "not_applicable");
  const score = scored.length === 0 ? 0 : Math.round(scored.reduce((total, area) => total + statusScore(area.status), 0) / scored.length);
  const highRisk = areas.filter((area) => area.risk === "high" && area.status !== "covered" && area.status !== "not_applicable").length;
  const missing = areas.filter((area) => area.status === "missing").length;
  const partial = areas.filter((area) => area.status === "partial").length;
  const covered = areas.filter((area) => area.status === "covered").length;
  const status = highRisk > 0 ? "blocked" : score >= 80 ? "beta_ready" : "partial";
  return {
    status,
    score,
    label: status === "beta_ready" ? "Couverture EC beta prête" : status === "blocked" ? "Couverture EC à risque" : "Couverture EC partielle",
    covered,
    partial,
    missing,
    highRisk,
    areas,
    generatedAt: new Date().toISOString(),
  };
}

function buildCoverageAreas(snapshot: AccountingCoverageSnapshot): CoverageArea[] {
  const statementsReady = ["BALANCE", "BILAN", "COMPTE_RESULTAT"].every((type) => snapshot.documentTypes.includes(type as DocumentType));
  const hasFec = snapshot.documentTypes.includes("FEC" as DocumentType);
  const hasTaxPackage = snapshot.documentTypes.includes("LIASSE_FISCALE" as DocumentType);
  return [
    area("transactions", "Transactions", snapshot.transactionCount === 0 ? "missing" : snapshot.reviewTransactionCount > 0 ? "partial" : "covered", snapshot.reviewTransactionCount > 0 ? "high" : "low", `${snapshot.transactionCount} transaction(s), ${snapshot.reviewTransactionCount} à vérifier`, [`${snapshot.categorizationCount} catégorisation(s)`], snapshot.reviewTransactionCount > 0 ? ["Transactions en revue à corriger"] : [], "Phase 6.5", "/transactions"),
    area("ledger", "Écritures", snapshot.journalEntryCount === 0 ? "missing" : snapshot.journalAuditStatus === "exportable" ? "covered" : "partial", snapshot.journalAuditStatus === "exportable" ? "low" : "high", `${snapshot.journalEntryCount} écriture(s), ${snapshot.journalLineCount} ligne(s)`, [`Audit journal : ${snapshot.journalAuditStatus}`], snapshot.journalAuditStatus === "exportable" ? [] : ["Journal à contrôler avant export"], "Phase 7.5", "/ecritures"),
    area(
      "evidence",
      "Justificatifs",
      snapshot.journalEntryCount === 0 ? "not_applicable" : snapshot.missingEvidence.missing > 0 || snapshot.orphanAttachmentCount > 0 || snapshot.extractionFailureCount > 0 ? "partial" : "covered",
      snapshot.missingEvidence.missing > 0 || snapshot.orphanAttachmentCount > 0 || snapshot.extractionFailureCount > 0 ? "medium" : "low",
      `${snapshot.missingEvidence.satisfied}/${snapshot.missingEvidence.total} preuve(s) satisfaite(s)`,
      [`${snapshot.attachmentCount} pièce(s)`, `${snapshot.attachmentLinkCount} rattachement(s)`],
      [
        ...(snapshot.missingEvidence.missing > 0 ? [entriesWithoutEvidenceLabel(snapshot.missingEvidence.missing)] : []),
        ...(snapshot.orphanAttachmentCount > 0 ? [`${snapshot.orphanAttachmentCount} pièce(s) sans écriture`] : []),
        ...(snapshot.extractionFailureCount > 0 ? [`${snapshot.extractionFailureCount} extraction(s) OCR échouée(s)`] : []),
      ],
      "Phase 11",
      "/couverture/evidence"
    ),
    area(
      "vat",
      "TVA",
      snapshot.vatReview.status === "not_applicable" ? "not_applicable" : snapshot.vatReview.status === "ready" ? "covered" : snapshot.vatReview.blockingCount > 0 ? "missing" : "partial",
      snapshot.vatReview.blockingCount > 0 ? "high" : snapshot.vatReview.warningCount > 0 ? "medium" : "low",
      snapshot.vatReview.status === "not_applicable" ? "Franchise TVA suivie" : `${snapshot.vatLineCount} ligne(s) TVA, ${snapshot.vatReview.controls.length} contrôle(s)`,
      [`Régime ${snapshot.vatRegime}`],
      snapshot.vatReview.controls.map((control) => control.title),
      "Phase 12",
      "/tva"
    ),
    area("documents", "Documents", hasFec && statementsReady && snapshot.staleDocumentCount === 0 ? "covered" : snapshot.documentTypes.length > 0 ? "partial" : "missing", !hasFec ? "high" : snapshot.staleDocumentCount > 0 ? "medium" : "low", `${snapshot.documentTypes.length} document(s), ${snapshot.staleDocumentCount} à régénérer`, snapshot.documentTypes, !hasFec ? ["FEC absent"] : snapshot.staleDocumentCount > 0 ? ["Documents à régénérer"] : [], "Phase 7", "/documents"),
    area("fec", "FEC", hasFec ? "covered" : "missing", hasFec ? "low" : "high", hasFec ? "FEC généré" : "FEC absent", hasFec ? ["Document FEC présent"] : [], hasFec ? [] : ["Générer le FEC"], "Phase 7.5", "/documents"),
    area("tax_package", "Liasse fiscale", hasTaxPackage ? "partial" : "missing", hasTaxPackage ? "medium" : "high", hasTaxPackage ? "Liasse brouillon disponible" : "Liasse non générée", hasTaxPackage ? ["Document liasse présent"] : [], hasTaxPackage ? ["Formulaire complet et télétransmission hors scope"] : ["Liasse structurée à générer"], "Phase 15", "/documents"),
    area(
      "reconciliations",
      "Rapprochements",
      (snapshot.reconciliationStatus ?? "missing") === "ready" && (snapshot.reconciliationProgress ?? 0) === 100 && (snapshot.reconciliationStaleCount ?? 0) === 0 ? "covered" : (snapshot.reconciliationProgress ?? 0) > 0 ? "partial" : "missing",
      (snapshot.reconciliationBlockingCount ?? 0) > 0 ? "high" : (snapshot.reconciliationWarningCount ?? 0) > 0 || (snapshot.reconciliationStaleCount ?? 0) > 0 ? "medium" : "low",
      `${snapshot.reconciliationProgress ?? 0}% traité · ${snapshot.reconciliationBlockingCount ?? 0} blocage(s), ${snapshot.reconciliationWarningCount ?? 0} alerte(s), ${snapshot.reconciliationStaleCount ?? 0} à relancer`,
      snapshot.matchedBankReconciliationCount > 0 ? ["Solde bancaire confirmé"] : [],
      [
        ...(snapshot.reconciliationBlockingCount && snapshot.reconciliationBlockingCount > 0 ? [`${snapshot.reconciliationBlockingCount} point(s) bloquant(s)`] : []),
        ...(snapshot.reconciliationWarningCount && snapshot.reconciliationWarningCount > 0 ? [`${snapshot.reconciliationWarningCount} point(s) à documenter`] : []),
        ...(snapshot.reconciliationStaleCount && snapshot.reconciliationStaleCount > 0 ? [`${snapshot.reconciliationStaleCount} rapprochement(s) à relancer`] : []),
        ...(snapshot.stripeCandidateCount > 0 ? [`${snapshot.stripeCandidateCount} candidat(s) Stripe`] : []),
      ],
      "Phase 13",
      "/rapprochements"
    ),
    area(
      "closing",
      "Clôture",
      snapshot.closingRunStatus === "CLOSED" ? "covered" : snapshot.closingRunCount > 0 || snapshot.approvedClosingAdjustments > 0 || snapshot.closingWorkpaperCount > 0 ? "partial" : "missing",
      snapshot.closingRequiredEvidenceMissing > 0 || snapshot.draftClosingAdjustments > 0 || (snapshot.closingAdjustmentStaleCount ?? 0) > 0 ? "high" : snapshot.closingRunStatus === "CLOSED" ? "low" : "medium",
      snapshot.closingRunStatus === "CLOSED" ? "Exercice clôturé" : `${snapshot.closingWorkpaperCount} feuille(s) de travail, ${snapshot.approvedClosingAdjustments} OD validée(s)`,
      [
        ...(snapshot.closingRunCount > 0 ? ["Run de clôture présent"] : []),
        ...(snapshot.closingWorkpaperCount > 0 ? [`${snapshot.closingWorkpaperCount} feuille(s) de travail`] : []),
        ...(snapshot.approvedClosingAdjustments > 0 ? [`${snapshot.approvedClosingAdjustments} OD validée(s)`] : []),
      ],
      [
        ...(snapshot.closingRunStatus === "CLOSED" ? [] : ["Clôture complète non finalisée"]),
        ...(snapshot.draftClosingAdjustments > 0 ? [`${snapshot.draftClosingAdjustments} OD à valider ou rejeter`] : []),
        ...(snapshot.rejectedClosingAdjustments > 0 ? [`${snapshot.rejectedClosingAdjustments} OD rejetée(s) avec note`] : []),
        ...((snapshot.closingAdjustmentStaleCount ?? 0) > 0 ? [`${snapshot.closingAdjustmentStaleCount} OD à recalculer`] : []),
        ...(snapshot.closingWorkpaperDraftCount > 0 ? [`${snapshot.closingWorkpaperDraftCount} feuille(s) de travail en brouillon`] : []),
        ...(snapshot.closingRequiredEvidenceMissing > 0 ? [`${snapshot.closingRequiredEvidenceMissing} pièce(s) requise(s) pour OD`] : []),
      ],
      "Phase 14",
      "/cloture/od"
    ),
    area("expert_review", "Revue expert-comptable", snapshot.expertValidationCount > 0 ? "covered" : snapshot.shareLinkCount > 0 ? "partial" : "missing", snapshot.expertValidationCount > 0 ? "low" : "high", snapshot.expertValidationCount > 0 ? "Validation EC présente" : "Validation EC absente", snapshot.shareLinkCount > 0 ? [`${snapshot.shareLinkCount} lien(s) de partage`] : [], snapshot.expertValidationCount > 0 ? [] : ["Créer un partage et obtenir une validation"], "Phase 15", "/dossier-ec"),
    area("audit_privacy", "Audit et RGPD", snapshot.activityCount > 0 ? "covered" : "partial", snapshot.activityCount > 0 ? "low" : "medium", `${snapshot.activityCount} événement(s) d'activité`, [`${snapshot.privacyRequestCount} demande(s) RGPD`], snapshot.activityCount > 0 ? [] : ["Activité insuffisante"], "Phase 10", "/activity"),
  ];
}

function area(code: CoverageAreaCode, title: string, status: CoverageStatus, risk: CoverageRisk, summary: string, evidence: string[], gaps: string[], nextPhase: string, href: string): CoverageArea {
  return { code, title, status, risk, summary, evidence, gaps, nextPhase, href };
}

function statusScore(status: CoverageStatus) {
  if (status === "covered") return 100;
  if (status === "partial") return 50;
  if (status === "not_applicable") return 100;
  return 0;
}

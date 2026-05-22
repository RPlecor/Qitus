import { AccountingCoverageCenter } from "../accounting-coverage/accounting-coverage-center.server";
import { EvidenceRequirementCenter } from "../accounting-coverage/evidence-requirement-center.server";
import { AccountingReviewCenter } from "../accounting-review/accounting-review-center.server";
import { BillingStatusCenter } from "../billing/billing-status-center.server";
import { ClosingAdjustmentFreshnessCenter } from "../closing-adjustments/closing-adjustment-freshness-center.server";
import { ClosingAdjustmentReviewWorkflow } from "../closing-adjustments/closing-adjustment-review-workflow.server";
import { ClosingWorkpaperCenter } from "../closing-workpapers/closing-workpaper-center.server";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { DocumentFreshnessCenter } from "../documents/document-freshness-center.server";
import { EvidenceControlCenter } from "../evidence/evidence-control-center.server";
import { ImportHistory } from "../import-orchestrator/import-history.server";
import { RegulatoryFreshnessCenter } from "../regulatory/regulatory-freshness-center.server";
import { ReconciliationFreshnessCenter } from "../reconciliations/reconciliation-freshness-center.server";
import { ReconciliationIssueWorkflow } from "../reconciliations/reconciliation-issue-workflow.server";
import { TransactionExplorer } from "../transactions/transaction-explorer.server";
import { VatDeclarationCenter } from "../vat/vat-declaration-center.server";
import { VatLedgerReadinessCenter } from "../vat/vat-ledger-readiness-center.server";
import type { NotificationSource, NotificationSpec } from "./notification-source.server";

export function defaultNotificationSources(): NotificationSource[] {
  return [
    new TransactionNotificationSource(),
    new ImportNotificationSource(),
    new DocumentFreshnessNotificationSource(),
    new AccountingReviewNotificationSource(),
    new VatNotificationSource(),
    new ReconciliationNotificationSource(),
    new ClosingNotificationSource(),
    new EvidenceNotificationSource(),
    new CoverageNotificationSource(),
    new BillingNotificationSource(),
    new RegulatoryNotificationSource(),
  ];
}

class TransactionNotificationSource implements NotificationSource {
  readonly sourceKey = "transactions";
  constructor(private readonly transactions = new TransactionExplorer()) {}

  async listNotificationSpecs(workspace: CompanyWorkspace): Promise<NotificationSpec[]> {
    const state = await this.transactions.summarizeTransactionState(workspace);
    if (state.review <= 0) return [];
    return [{
      type: "TRANSACTION_REVIEW",
      severity: "BLOCKING",
      title: `${state.review} transaction${state.review > 1 ? "s" : ""} à vérifier`,
      body: "Corrigez les transactions en revue avant génération documentaire ou clôture.",
      href: "/transactions?status=review",
      dedupeKey: "transactions:review",
      metadata: { count: state.review },
    }];
  }
}

class ImportNotificationSource implements NotificationSource {
  readonly sourceKey = "imports";
  constructor(private readonly imports = new ImportHistory()) {}

  async listNotificationSpecs(workspace: CompanyWorkspace): Promise<NotificationSpec[]> {
    const imports = await this.imports.listImports(workspace.fiscalYear.id);
    return imports.filter((item) => item.statusKind === "error" || item.actions.needsMapping).map((item) => ({
      type: "IMPORT_STATUS",
      severity: item.statusKind === "error" ? "BLOCKING" : "WARNING",
      title: item.statusKind === "error" ? "Import échoué" : "Mapping CSV requis",
      body: item.filename,
      href: item.actions.needsMapping ? `/imports/${item.id}/mapping` : "/imports",
      dedupeKey: `import:${item.id}:${item.status}`,
      metadata: { importId: item.id, status: item.status },
    }));
  }
}

class DocumentFreshnessNotificationSource implements NotificationSource {
  readonly sourceKey = "documents";
  constructor(private readonly freshness = new DocumentFreshnessCenter()) {}

  async listNotificationSpecs(workspace: CompanyWorkspace): Promise<NotificationSpec[]> {
    const freshness = await this.freshness.getFreshness(workspace);
    if (freshness.staleCount <= 0) return [];
    return [{
      type: "DOCUMENT_STALE",
      severity: "WARNING",
      title: `${freshness.staleCount} document${freshness.staleCount > 1 ? "s" : ""} à régénérer`,
      body: "Des écritures ou corrections sont plus récentes que les documents.",
      href: "/documents",
      dedupeKey: "documents:stale",
      metadata: { staleCount: freshness.staleCount },
    }];
  }
}

class AccountingReviewNotificationSource implements NotificationSource {
  readonly sourceKey = "accounting-review";
  constructor(private readonly accountingReview = new AccountingReviewCenter()) {}

  async listNotificationSpecs(workspace: CompanyWorkspace): Promise<NotificationSpec[]> {
    const review = await this.accountingReview.getReview(workspace);
    if (review.blockingCount <= 0) return [];
    return [{
      type: "CLOSING_BLOCKER",
      severity: "BLOCKING",
      title: `${review.blockingCount} blocage${review.blockingCount > 1 ? "s" : ""} de pré-clôture`,
      body: "Le contrôle comptable signale des points bloquants.",
      href: "/controle",
      dedupeKey: "accounting-review:blockers",
      metadata: { blockingCount: review.blockingCount, warningCount: review.warningCount },
    }];
  }
}

export class VatNotificationSource implements NotificationSource {
  readonly sourceKey = "vat";
  constructor(
    private readonly vat = new VatDeclarationCenter(),
    private readonly ledgerReadiness = new VatLedgerReadinessCenter()
  ) {}

  async listNotificationSpecs(workspace: CompanyWorkspace): Promise<NotificationSpec[]> {
    const [vatReview, ledgerReadiness] = await Promise.all([
      this.vat.getVatReview(workspace),
      this.ledgerReadiness.getReadiness(workspace),
    ]);
    const specs: NotificationSpec[] = [];
    if (ledgerReadiness.status !== "ok") {
      specs.push({
        type: "VAT_ALERT",
        severity: ledgerReadiness.status === "action_required" ? "BLOCKING" : "WARNING",
        title: ledgerReadiness.title,
        body: ledgerReadiness.message,
        href: "/tva",
        dedupeKey: "vat:ledger-readiness",
        metadata: { status: ledgerReadiness.status, counters: ledgerReadiness.counters },
      });
    }
    if (vatReview.controls.length > 0) {
      specs.push({
        type: "VAT_ALERT",
        severity: vatReview.blockingCount > 0 ? "BLOCKING" : "WARNING",
        title: "Contrôles TVA à traiter",
        body: `${vatReview.controls.length} contrôle(s) TVA actif(s).`,
        href: "/tva",
        dedupeKey: "vat:controls",
        metadata: { status: vatReview.status, blockingCount: vatReview.blockingCount, warningCount: vatReview.warningCount },
      });
    }
    return specs;
  }
}

class ReconciliationNotificationSource implements NotificationSource {
  readonly sourceKey = "reconciliations";
  constructor(
    private readonly reconciliations = new ReconciliationIssueWorkflow(),
    private readonly freshness = new ReconciliationFreshnessCenter()
  ) {}

  async listNotificationSpecs(workspace: CompanyWorkspace): Promise<NotificationSpec[]> {
    const [reconciliation, freshness] = await Promise.all([
      this.reconciliations.summarizeReconciliationReadiness(workspace),
      this.freshness.getFreshness(workspace),
    ]);
    const specs: NotificationSpec[] = [];
    if (reconciliation.issues.open > 0) {
      specs.push({
        type: "CLOSING_BLOCKER",
        severity: reconciliation.issues.blocking > 0 ? "BLOCKING" : "WARNING",
        title: `${reconciliation.issues.open} point${reconciliation.issues.open > 1 ? "s" : ""} de rapprochement`,
        body: "Banque, Stripe, tiers ou comptes d'attente nécessitent une revue ligne à ligne.",
        href: "/rapprochements",
        dedupeKey: "reconciliations:open-issues",
        metadata: { blocking: reconciliation.issues.blocking, warning: reconciliation.issues.warning },
      });
    }
    if (freshness.staleCount > 0) {
      specs.push({
        type: "CLOSING_BLOCKER",
        severity: "WARNING",
        title: `${freshness.staleCount} rapprochement${freshness.staleCount > 1 ? "s" : ""} à relancer`,
        body: "Des imports, corrections ou écritures sont plus récents que les rapprochements.",
        href: "/rapprochements",
        dedupeKey: "reconciliations:stale",
        metadata: { staleCount: freshness.staleCount },
      });
    }
    return specs;
  }
}

class ClosingNotificationSource implements NotificationSource {
  readonly sourceKey = "closing";
  constructor(
    private readonly workpapers = new ClosingWorkpaperCenter(),
    private readonly adjustments = new ClosingAdjustmentReviewWorkflow(),
    private readonly freshness = new ClosingAdjustmentFreshnessCenter()
  ) {}

  async listNotificationSpecs(workspace: CompanyWorkspace): Promise<NotificationSpec[]> {
    const [closingWorkpapers, closingAdjustmentReadiness, closingAdjustmentFreshness] = await Promise.all([
      this.workpapers.summarizeWorkpapers(workspace),
      this.adjustments.summarizeAdjustmentReadiness(workspace),
      this.freshness.getFreshness(workspace),
    ]);
    const specs: Array<NotificationSpec | null> = [
      closingWorkpapers.proposals.draft > 0 ? {
        type: "CLOSING_BLOCKER" as const,
        severity: "WARNING" as const,
        title: `${closingWorkpapers.proposals.draft} OD de clôture à relire`,
        body: "Des propositions d'OD généralisées attendent validation ou rejet motivé.",
        href: "/cloture/od",
        dedupeKey: "closing-adjustments:draft",
        metadata: closingWorkpapers,
      } : null,
      closingWorkpapers.draft > 0 ? {
        type: "CLOSING_BLOCKER" as const,
        severity: "INFO" as const,
        title: `${closingWorkpapers.draft} workpaper de clôture incomplet`,
        body: "Complète les hypothèses avant de générer les propositions d'OD.",
        href: "/cloture/od",
        dedupeKey: "closing-workpapers:draft",
        metadata: closingWorkpapers,
      } : null,
      closingWorkpapers.requiredEvidenceMissing > 0 ? {
        type: "CLOSING_BLOCKER" as const,
        severity: "WARNING" as const,
        title: `${closingWorkpapers.requiredEvidenceMissing} pièce requise pour OD`,
        body: "Certaines OD de clôture doivent être rattachées à une pièce avant clôture.",
        href: "/cloture/od",
        dedupeKey: "closing-adjustments:evidence-missing",
        metadata: closingWorkpapers,
      } : null,
      closingAdjustmentFreshness.staleCount > 0 ? {
        type: "CLOSING_BLOCKER" as const,
        severity: "WARNING" as const,
        title: `${closingAdjustmentFreshness.staleCount} OD à recalculer`,
        body: "Des workpapers, pièces ou écritures sont plus récents que les propositions OD.",
        href: "/cloture/od?tab=review",
        dedupeKey: "closing-adjustments:stale",
        metadata: closingAdjustmentFreshness,
      } : null,
      closingAdjustmentReadiness.rejected > 0 ? {
        type: "CLOSING_BLOCKER" as const,
        severity: "INFO" as const,
        title: `${closingAdjustmentReadiness.rejected} OD rejetée${closingAdjustmentReadiness.rejected > 1 ? "s" : ""}`,
        body: "Les rejets motivés restent visibles dans le dossier de preuve.",
        href: "/cloture/od?tab=rejected",
        dedupeKey: "closing-adjustments:rejected",
        metadata: closingAdjustmentReadiness,
      } : null,
    ];
    return specs.filter((spec): spec is NotificationSpec => spec !== null);
  }
}

class EvidenceNotificationSource implements NotificationSource {
  readonly sourceKey = "evidence";
  constructor(
    private readonly evidence = new EvidenceRequirementCenter(),
    private readonly evidenceControl = new EvidenceControlCenter()
  ) {}

  async listNotificationSpecs(workspace: CompanyWorkspace): Promise<NotificationSpec[]> {
    const [evidence, evidenceReview] = await Promise.all([
      this.evidence.summarizeEvidenceGaps(workspace),
      this.evidenceControl.getEvidenceReview(workspace),
    ]);
    const specs: Array<NotificationSpec | null> = [
      evidence.requiredMissing > 0 ? {
        type: "CLOSING_BLOCKER" as const,
        severity: "WARNING" as const,
        title: `${evidence.requiredMissing} justificatif${evidence.requiredMissing > 1 ? "s" : ""} requis manquant${evidence.requiredMissing > 1 ? "s" : ""}`,
        body: "Le dossier expert-comptable signale des écritures sans pièce rattachée.",
        href: "/couverture/evidence",
        dedupeKey: "coverage:evidence-missing",
        metadata: evidence,
      } : null,
      evidenceReview.orphanAttachments > 0 ? {
        type: "CLOSING_BLOCKER" as const,
        severity: "INFO" as const,
        title: `${evidenceReview.orphanAttachments} pièce${evidenceReview.orphanAttachments > 1 ? "s" : ""} sans rattachement`,
        body: "Des pièces ont été déposées mais ne sont pas reliées à une transaction, une écriture ou une OD.",
        href: "/pieces?orphan=1",
        dedupeKey: "evidence:orphan-attachments",
        metadata: { count: evidenceReview.orphanAttachments },
      } : null,
      evidenceReview.extractionFailures > 0 ? {
        type: "CLOSING_BLOCKER" as const,
        severity: "INFO" as const,
        title: `${evidenceReview.extractionFailures} extraction${evidenceReview.extractionFailures > 1 ? "s" : ""} OCR à revoir`,
        body: "L'OCR local n'a pas pu lire certaines pièces ; elles restent corrigeables manuellement.",
        href: "/pieces?extractionError=1",
        dedupeKey: "evidence:extraction-failed",
        metadata: { count: evidenceReview.extractionFailures },
      } : null,
    ];
    return specs.filter((spec): spec is NotificationSpec => spec !== null);
  }
}

class CoverageNotificationSource implements NotificationSource {
  readonly sourceKey = "coverage";
  constructor(private readonly coverage = new AccountingCoverageCenter()) {}

  async listNotificationSpecs(workspace: CompanyWorkspace): Promise<NotificationSpec[]> {
    const coverage = await this.coverage.getCoverageOverview(workspace);
    const specs: Array<NotificationSpec | null> = [
      coverage.status !== "beta_ready" ? {
        type: "CLOSING_BLOCKER" as const,
        severity: coverage.highRisk > 0 ? "WARNING" as const : "INFO" as const,
        title: coverage.label,
        body: `Score de couverture EC : ${coverage.score}/100.`,
        href: "/couverture",
        dedupeKey: "coverage:summary",
        metadata: { score: coverage.score, highRisk: coverage.highRisk },
      } : null,
      coverage.areas.find((area) => area.code === "vat" && area.status !== "covered") ? {
        type: "VAT_ALERT" as const,
        severity: "INFO" as const,
        title: "Couverture TVA à compléter",
        body: "La position TVA est disponible ; génère le brouillon CA3/CA12 si applicable.",
        href: "/tva",
        dedupeKey: "coverage:vat-partial",
        metadata: { nextPhase: "Phase 12" },
      } : null,
    ];
    return specs.filter((spec): spec is NotificationSpec => spec !== null);
  }
}

class BillingNotificationSource implements NotificationSource {
  readonly sourceKey = "billing";
  constructor(private readonly billing = new BillingStatusCenter()) {}

  async listNotificationSpecs(workspace: CompanyWorkspace): Promise<NotificationSpec[]> {
    const billing = await this.billing.getBillingStatus(workspace);
    if (billing.usage.remaining.aiCalls > 0 && billing.usage.remaining.imports > 0) return [];
    return [{
      type: "USAGE_LIMIT",
      severity: "WARNING",
      title: "Quota d'usage atteint",
      body: "Un quota abonnement est à zéro.",
      href: "/abonnement",
      dedupeKey: "usage:limit",
      metadata: { remaining: billing.usage.remaining },
    }];
  }
}

class RegulatoryNotificationSource implements NotificationSource {
  readonly sourceKey = "regulatory";
  constructor(private readonly regulatory = new RegulatoryFreshnessCenter()) {}

  async listNotificationSpecs(workspace: CompanyWorkspace): Promise<NotificationSpec[]> {
    return this.regulatory.buildRegulatoryNotifications(workspace);
  }
}

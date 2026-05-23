import type { FiscalYearStatus } from "@prisma/client";
import { ClosingAdjustmentFreshnessCenter } from "../closing-adjustments/closing-adjustment-freshness-center.server";
import { RuleApplicationWorkflow } from "../accounting-rules/rule-application-workflow.server";
import { AutomationOpportunityCenter } from "../automation/automation-opportunity-center.server";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { DocumentFreshnessCenter } from "../documents/document-freshness-center.server";
import { EvidenceControlCenter } from "../evidence/evidence-control-center.server";
import { DossierSnapshotReviewCenter } from "../expert-dossier/dossier-snapshot-review-center.server";
import { ExpertDossierReadinessWorkflow } from "../expert-dossier/expert-dossier-readiness-workflow.server";
import { FecPrecheckCenter } from "../expert-dossier/fec-precheck-center.server";
import { OpenBankingFreshnessCenter } from "../open-banking/open-banking-freshness-center.server";
import { ReconciliationFreshnessCenter } from "../reconciliations/reconciliation-freshness-center.server";
import { ExpectedRouteError } from "../route-errors.server";
import { getRuntimeConfig, type ChangeImpactsMode } from "../runtime-config.server";
import { StorageAuditCenter } from "../storage/storage-audit-center.server";
import { VatDeclarationCenter } from "../vat/vat-declaration-center.server";
import { VatLedgerReadinessCenter } from "../vat/vat-ledger-readiness-center.server";
import { EInvoiceProviderConnectionCenter } from "../e-invoices/e-invoice-provider-connection-center.server";

export type ChangeImpactStatus = "ok" | "warning" | "action_required" | "blocked";
export type ChangeImpactSeverity = "info" | "warning" | "blocking";
export type ChangeImpactSurface = "dashboard" | "imports" | "documents" | "tva" | "cloture" | "couverture" | "dossier_ec" | "connecteurs";
export type ChangeImpactCapability =
  | "generate_documents"
  | "generate_fec"
  | "generate_vat_declaration"
  | "approve_closing_adjustment"
  | "close_fiscal_year"
  | "prepare_expert_dossier"
  | "export_expert_dossier"
  | "sync_connectors";

export type ChangeImpactAction = {
  label: string;
  href: string;
};

export type ChangeImpact = {
  code: string;
  source: string;
  status: ChangeImpactStatus;
  severity: ChangeImpactSeverity;
  title: string;
  message: string;
  why: string[];
  surfaces: ChangeImpactSurface[];
  blockingCapabilities: ChangeImpactCapability[];
  affectedArtifacts: string[];
  primaryAction: ChangeImpactAction;
  secondaryAction?: ChangeImpactAction;
  generatedAt: string;
  metadata?: unknown;
};

export type ChangeImpactFilters = {
  surface?: ChangeImpactSurface;
  includeDetails?: boolean;
};

export type ChangeImpactOverview = {
  mode: ChangeImpactsMode;
  status: ChangeImpactStatus;
  generatedAt: string;
  total: number;
  blocking: number;
  actionRequired: number;
  warning: number;
  impacts: ChangeImpact[];
  performanceBudget: {
    targetMs: number;
    sourceCount: number;
    durationMs: number;
  };
};

export type ChangeImpactSourceOptions = {
  includeDetails?: boolean;
  surface?: ChangeImpactSurface;
};

export type ChangeImpactSource = {
  sourceKey: string;
  surfaces: ChangeImpactSurface[];
  listImpacts(workspace: CompanyWorkspace, options?: ChangeImpactSourceOptions): Promise<ChangeImpact[]>;
};

const DASHBOARD_SOURCE_KEYS = new Set(["accounting-rules", "imports-ledger", "documents", "fec", "vat", "e-invoices", "reconciliations", "closing", "automation"]);
const HEAVY_SOURCE_KEYS = new Set(["evidence", "expert-dossier", "connectors"]);

export class ChangeImpactCenter {
  constructor(
    private readonly sources: ChangeImpactSource[] = defaultChangeImpactSources(),
    private readonly mode: ChangeImpactsMode = getRuntimeConfig().changeImpactsMode
  ) {}

  async getImpactOverview(workspace: CompanyWorkspace, filters: ChangeImpactFilters = {}): Promise<ChangeImpactOverview> {
    if (this.mode === "off") return emptyOverview(this.mode);
    const startedAt = Date.now();
    const sources = this.sourcesFor(filters.surface);
    const batches = await Promise.all(sources.map((source) => source.listImpacts(workspace, {
      includeDetails: filters.includeDetails,
      surface: filters.surface,
    }).catch((error) => [impact({
      code: `impact_source_failed:${source.sourceKey}`,
      source: source.sourceKey,
      status: "warning",
      severity: "warning",
      title: "Diagnostic partiel",
      message: "Un diagnostic d'impact n'a pas pu être calculé.",
      why: [error instanceof Error ? error.message : "Erreur inconnue."],
      surfaces: source.surfaces,
      blockingCapabilities: [],
      affectedArtifacts: [],
      primaryAction: { label: "Réessayer", href: "/dashboard" },
    })])));
    const impacts = sortImpacts(batches.flat());
    return {
      mode: this.mode,
      status: overviewStatus(impacts),
      generatedAt: new Date().toISOString(),
      total: impacts.length,
      blocking: impacts.filter((item) => item.severity === "blocking").length,
      actionRequired: impacts.filter((item) => item.status === "action_required" || item.status === "blocked").length,
      warning: impacts.filter((item) => item.severity === "warning").length,
      impacts,
      performanceBudget: {
        targetMs: 200,
        sourceCount: sources.length,
        durationMs: Date.now() - startedAt,
      },
    };
  }

  async listImpacts(workspace: CompanyWorkspace, filters: ChangeImpactFilters = {}) {
    return (await this.getImpactOverview(workspace, filters)).impacts;
  }

  async getImpactsForSurface(workspace: CompanyWorkspace, surface: ChangeImpactSurface) {
    return this.listImpacts(workspace, { surface });
  }

  async assertNoBlockingImpact(workspace: CompanyWorkspace, capability: ChangeImpactCapability) {
    const impacts = await this.listImpacts(workspace);
    const blocker = impacts.find((item) => item.blockingCapabilities.includes(capability) && item.severity === "blocking");
    if (blocker) throw new ExpectedRouteError(blocker.message, 409);
    return { capability, ok: true };
  }

  private sourcesFor(surface?: ChangeImpactSurface) {
    if (!surface) return this.sources;
    return this.sources.filter((source) => {
      if (!source.surfaces.includes(surface)) return false;
      if (surface === "dashboard") return DASHBOARD_SOURCE_KEYS.has(source.sourceKey);
      if (!["documents", "dossier_ec", "connecteurs"].includes(surface) && HEAVY_SOURCE_KEYS.has(source.sourceKey)) return false;
      return true;
    });
  }
}

export class DocumentImpactSource implements ChangeImpactSource {
  readonly sourceKey = "documents";
  readonly surfaces: ChangeImpactSurface[] = ["dashboard", "documents", "couverture", "dossier_ec"];
  constructor(private readonly freshness = new DocumentFreshnessCenter()) {}

  async listImpacts(workspace: CompanyWorkspace): Promise<ChangeImpact[]> {
    const freshness = await this.freshness.getFreshness(workspace);
    if (freshness.staleCount <= 0) return [];
    return [impact({
      code: "documents.stale",
      source: this.sourceKey,
      status: "action_required",
      severity: "warning",
      title: `${freshness.staleCount} document${freshness.staleCount > 1 ? "s" : ""} à régénérer`,
      message: "Des documents sont antérieurs aux dernières données comptables ou au profil entreprise.",
      why: freshness.reasons.map((reason) => reason.label),
      surfaces: this.surfaces,
      blockingCapabilities: ["close_fiscal_year"],
      affectedArtifacts: freshness.documents.filter((document) => document.isStale).map((document) => document.filename),
      primaryAction: { label: "Ouvrir les documents", href: "/documents" },
      metadata: { staleCount: freshness.staleCount },
    })];
  }
}

export class FecImpactSource implements ChangeImpactSource {
  readonly sourceKey = "fec";
  readonly surfaces: ChangeImpactSurface[] = ["dashboard", "documents", "couverture", "dossier_ec"];
  constructor(private readonly fec = new FecPrecheckCenter()) {}

  async listImpacts(workspace: CompanyWorkspace): Promise<ChangeImpact[]> {
    const precheck = await this.fec.getFecPrecheck(workspace);
    if (precheck.status === "ready") return [];
    return [impact({
      code: "fec.precheck",
      source: this.sourceKey,
      status: precheck.blockingCount > 0 ? "blocked" : "warning",
      severity: precheck.blockingCount > 0 ? "blocking" : "warning",
      title: precheck.label,
      message: precheck.issues[0]?.detail ?? "Le FEC nécessite un contrôle.",
      why: precheck.issues.map((issue) => issue.label),
      surfaces: this.surfaces,
      blockingCapabilities: precheck.blockingCount > 0 ? ["generate_fec", "prepare_expert_dossier"] : [],
      affectedArtifacts: precheck.fec ? [precheck.fec.filename] : ["FEC"],
      primaryAction: { label: precheck.fec ? "Régénérer le FEC" : "Générer le FEC", href: "/documents" },
      metadata: { blockingCount: precheck.blockingCount, warningCount: precheck.warningCount },
    })];
  }
}

export class VatImpactSource implements ChangeImpactSource {
  readonly sourceKey = "vat";
  readonly surfaces: ChangeImpactSurface[] = ["dashboard", "tva", "couverture", "cloture", "dossier_ec"];
  constructor(
    private readonly ledgerReadiness = new VatLedgerReadinessCenter(),
    private readonly declarations = new VatDeclarationCenter()
  ) {}

  async listImpacts(workspace: CompanyWorkspace): Promise<ChangeImpact[]> {
    const [readiness, review] = await Promise.all([
      this.ledgerReadiness.getReadiness(workspace),
      this.declarations.getVatReview(workspace),
    ]);
    const impacts: ChangeImpact[] = [];
    if (readiness.status !== "ok") {
      impacts.push(impact({
        code: "vat.ledger_readiness",
        source: this.sourceKey,
        status: readiness.status,
        severity: readiness.status === "action_required" ? "blocking" : "warning",
        title: readiness.title,
        message: readiness.message,
        why: [readiness.message],
        surfaces: this.surfaces,
        blockingCapabilities: readiness.status === "action_required" ? ["generate_vat_declaration"] : [],
        affectedArtifacts: ["Position TVA", "CA3/CA12"],
        primaryAction: readiness.actions.find((action) => action.primary) ?? readiness.actions[0] ?? { label: "Ouvrir la TVA", href: "/tva" },
        secondaryAction: readiness.actions.find((action) => !action.primary),
        metadata: readiness.counters,
      }));
    }
    if (review.blockingCount > 0 || review.warningCount > 0) {
      impacts.push(impact({
        code: "vat.controls",
        source: this.sourceKey,
        status: review.blockingCount > 0 ? "blocked" : "warning",
        severity: review.blockingCount > 0 ? "blocking" : "warning",
        title: "Contrôles TVA à traiter",
        message: `${review.controls.length} contrôle(s) TVA actif(s).`,
        why: review.controls.map((control) => control.title),
        surfaces: this.surfaces,
        blockingCapabilities: review.blockingCount > 0 ? ["generate_vat_declaration"] : [],
        affectedArtifacts: ["Déclaration TVA"],
        primaryAction: { label: "Ouvrir la revue TVA", href: "/tva/revue" },
        metadata: { blockingCount: review.blockingCount, warningCount: review.warningCount },
      }));
    }
    return impacts;
  }
}

export class ImportLedgerImpactSource implements ChangeImpactSource {
  readonly sourceKey = "imports-ledger";
  readonly surfaces: ChangeImpactSurface[] = ["dashboard", "imports", "tva", "couverture"];

  async listImpacts(workspace: CompanyWorkspace): Promise<ChangeImpact[]> {
    const rows = await prisma.transaction.findMany({
      where: {
        fiscalYearId: workspace.fiscalYear.id,
        journalEntryId: { not: null },
        categorization: { isNot: null },
      },
      include: { categorization: true, journalEntry: true },
      take: 500,
    });
    const staleRows = rows.filter((row) => row.categorization && row.journalEntry && row.categorization.updatedAt > row.journalEntry.updatedAt);
    if (staleRows.length === 0) return [];
    return [impact({
      code: "imports.ledger_entries_not_rebuilt",
      source: this.sourceKey,
      status: "action_required",
      severity: "warning",
      title: `${staleRows.length} écriture${staleRows.length > 1 ? "s" : ""} à revoir après recatégorisation`,
      message: "Des catégorisations sont plus récentes que les écritures déjà générées. Qitus ne reconstruit pas ces écritures automatiquement.",
      why: ["La relance de catégorisation protège les écritures existantes pour éviter les doublons ou mutations silencieuses."],
      surfaces: this.surfaces,
      blockingCapabilities: [],
      affectedArtifacts: staleRows.slice(0, 5).map((row) => row.label),
      primaryAction: { label: "Ouvrir les imports", href: "/imports" },
      secondaryAction: { label: "Voir les transactions à vérifier", href: "/transactions?status=review" },
      metadata: { count: staleRows.length },
    })];
  }
}

export class EInvoiceImpactSource implements ChangeImpactSource {
  readonly sourceKey = "e-invoices";
  readonly surfaces: ChangeImpactSurface[] = ["dashboard", "documents", "tva", "couverture", "dossier_ec", "connecteurs"];
  constructor(private readonly providerConnections = new EInvoiceProviderConnectionCenter()) {}

  async listImpacts(workspace: CompanyWorkspace): Promise<ChangeImpact[]> {
    const [readiness, pendingInvoices, readyDrafts, providerPendingInvoices, accountedSinceDocs] = await Promise.all([
      this.providerConnections.getReadiness(workspace),
      prisma.eInvoice.count({
        where: {
          companyId: workspace.company.id,
          fiscalYearId: workspace.fiscalYear.id,
          status: { in: ["PARSED", "MATCHED"] },
          archivedAt: null,
        },
      }),
      prisma.eInvoiceAccountingDraft.count({
        where: { companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id, status: "READY" },
      }),
      prisma.eInvoice.count({
        where: {
          companyId: workspace.company.id,
          fiscalYearId: workspace.fiscalYear.id,
          source: "PROVIDER",
          status: { notIn: ["ACCOUNTED", "ARCHIVED"] },
          archivedAt: null,
        },
      }),
      prisma.eInvoiceAccountingDraft.count({
        where: {
          companyId: workspace.company.id,
          fiscalYearId: workspace.fiscalYear.id,
          status: "APPROVED",
          journalEntryId: { not: null },
        },
      }),
    ]);
    const impacts: ChangeImpact[] = [];
    if (!readiness.receptionCompliant) {
      impacts.push(impact({
        code: "e_invoices.pa_not_compliant",
        source: this.sourceKey,
        status: "warning",
        severity: "warning",
        title: "Réception PA non conforme ou non connectée",
        message: readiness.message,
        why: ["Qitus exploite les factures, mais la réception réglementaire doit passer par une Plateforme Agréée réelle."],
        surfaces: ["connecteurs", "dossier_ec", "couverture"],
        blockingCapabilities: [],
        affectedArtifacts: ["Factures entrantes", "Dossier EC"],
        primaryAction: { label: "Ouvrir les connecteurs", href: "/connecteurs" },
        metadata: { readiness },
      }));
    }
    if (pendingInvoices > 0) {
      impacts.push(impact({
        code: "e_invoices.pending",
        source: this.sourceKey,
        status: "action_required",
        severity: "warning",
        title: `${pendingInvoices} facture${pendingInvoices > 1 ? "s" : ""} entrante${pendingInvoices > 1 ? "s" : ""} à traiter`,
        message: "Des factures électroniques sont parsées mais pas encore comptabilisées.",
        why: ["Une facture structurée reçue doit être rapprochée ou transformée en brouillon comptable."],
        surfaces: this.surfaces,
        blockingCapabilities: [],
        affectedArtifacts: ["Pièces", "TVA", "Dossier de preuve"],
        primaryAction: { label: "Ouvrir les factures entrantes", href: "/factures-entrantes" },
        metadata: { pendingInvoices },
      }));
    }
    if (providerPendingInvoices > 0) {
      impacts.push(impact({
        code: "e_invoices.provider_received_not_accounted",
        source: this.sourceKey,
        status: "action_required",
        severity: "warning",
        title: `${providerPendingInvoices} facture${providerPendingInvoices > 1 ? "s" : ""} reçue${providerPendingInvoices > 1 ? "s" : ""} via PA à traiter`,
        message: "Des factures reçues par provider PA ne sont pas encore comptabilisées.",
        why: ["La réception PA ne suffit pas : Qitus attend une revue et une validation utilisateur avant écriture."],
        surfaces: this.surfaces,
        blockingCapabilities: [],
        affectedArtifacts: ["Journal", "TVA", "Dossier EC"],
        primaryAction: { label: "Ouvrir les factures entrantes", href: "/factures-entrantes" },
        metadata: { providerPendingInvoices },
      }));
    }
    if (readyDrafts > 0) {
      impacts.push(impact({
        code: "e_invoices.ready_drafts",
        source: this.sourceKey,
        status: "action_required",
        severity: "warning",
        title: `${readyDrafts} brouillon${readyDrafts > 1 ? "s" : ""} facture à approuver`,
        message: "Les lignes comptables sont proposées mais aucune écriture n'est créée tant que l'utilisateur n'approuve pas.",
        why: ["Qitus ne crée pas d'écriture facture fournisseur automatiquement."],
        surfaces: this.surfaces,
        blockingCapabilities: [],
        affectedArtifacts: ["Journal", "FEC", "TVA"],
        primaryAction: { label: "Relire les brouillons", href: "/factures-entrantes?status=ACCOUNTING_DRAFT" },
        metadata: { readyDrafts },
      }));
    }
    if (accountedSinceDocs > 0) {
      impacts.push(impact({
        code: "e_invoices.accounted_documents",
        source: this.sourceKey,
        status: "warning",
        severity: "info",
        title: "Factures électroniques comptabilisées",
        message: "Si des documents existaient déjà, ils peuvent devoir être régénérés pour inclure ces écritures.",
        why: ["Une écriture E_INVOICE modifie le journal comptable."],
        surfaces: this.surfaces,
        blockingCapabilities: [],
        affectedArtifacts: ["FEC", "Paquet de preuve"],
        primaryAction: { label: "Ouvrir les documents", href: "/documents" },
        metadata: { accountedSinceDocs },
      }));
    }
    return impacts;
  }
}

export class AccountingRulesImpactSource implements ChangeImpactSource {
  readonly sourceKey = "accounting-rules";
  readonly surfaces: ChangeImpactSurface[] = ["dashboard", "imports", "couverture"];
  constructor(private readonly workflow = new RuleApplicationWorkflow()) {}

  async listImpacts(workspace: CompanyWorkspace): Promise<ChangeImpact[]> {
    const status = await this.workflow.getRuleUpdateStatus(workspace);
    const activePack = status.activePack;
    if (!activePack) return [impact({
      code: "accounting_rules.missing_pack",
      source: this.sourceKey,
      status: "warning",
      severity: "warning",
      title: "Règles comptables à initialiser",
      message: "Aucun pack de règles Qitus actif n'est disponible pour les futurs imports.",
      why: ["Synchronise les règles officielles ou relance le seed Qitus."],
      surfaces: this.surfaces,
      blockingCapabilities: [],
      affectedArtifacts: ["VendorMapping"],
      primaryAction: { label: "Ouvrir les règles comptables", href: "/regles-comptables" },
    })];

    if (!status.application) return [];

    const impactPreview = status.impact as { affectedTransactionCount?: number; conflictCount?: number; existingDataRequiresExplicitAction?: boolean } | null;
    if (!impactPreview?.existingDataRequiresExplicitAction) return [];
    return [impact({
      code: "accounting_rules.existing_data_impacted",
      source: this.sourceKey,
      status: "warning",
      severity: "warning",
      title: "Règles comptables mises à jour",
      message: "Les futurs imports utilisent les règles à jour. Des transactions existantes pourraient bénéficier d'une relance explicite de catégorisation.",
      why: [
        `${impactPreview.affectedTransactionCount ?? 0} transaction(s) existante(s) potentiellement concernée(s).`,
        `${impactPreview.conflictCount ?? 0} conflit(s) avec des règles utilisateur prioritaires.`,
      ],
      surfaces: this.surfaces,
      blockingCapabilities: [],
      affectedArtifacts: ["Imports existants", "Catégorisations"],
      primaryAction: { label: "Ouvrir les règles comptables", href: "/regles-comptables" },
      secondaryAction: { label: "Ouvrir les imports", href: "/imports" },
      metadata: impactPreview,
    })];
  }
}

export class ReconciliationImpactSource implements ChangeImpactSource {
  readonly sourceKey = "reconciliations";
  readonly surfaces: ChangeImpactSurface[] = ["dashboard", "cloture", "couverture", "dossier_ec"];
  constructor(private readonly freshness = new ReconciliationFreshnessCenter()) {}

  async listImpacts(workspace: CompanyWorkspace): Promise<ChangeImpact[]> {
    const freshness = await this.freshness.getFreshness(workspace);
    if (freshness.staleCount <= 0) return [];
    const staleRuns = Object.values(freshness.runs).filter((run) => run.status === "stale");
    return [impact({
      code: "reconciliations.stale",
      source: this.sourceKey,
      status: "action_required",
      severity: "warning",
      title: `${freshness.staleCount} rapprochement${freshness.staleCount > 1 ? "s" : ""} à relancer`,
      message: "Des imports, corrections ou écritures sont plus récents que les rapprochements.",
      why: staleRuns.flatMap((run) => run.staleReasons),
      surfaces: this.surfaces,
      blockingCapabilities: staleRuns.some((run) => run.kind === "BANK") ? ["close_fiscal_year"] : [],
      affectedArtifacts: staleRuns.map((run) => `Rapprochement ${run.kind}`),
      primaryAction: { label: "Ouvrir les rapprochements", href: "/rapprochements" },
      metadata: { staleCount: freshness.staleCount },
    })];
  }
}

export class ClosingImpactSource implements ChangeImpactSource {
  readonly sourceKey = "closing";
  readonly surfaces: ChangeImpactSurface[] = ["dashboard", "cloture", "couverture", "dossier_ec"];
  constructor(private readonly freshness = new ClosingAdjustmentFreshnessCenter()) {}

  async listImpacts(workspace: CompanyWorkspace): Promise<ChangeImpact[]> {
    const freshness = await this.freshness.getFreshness(workspace);
    if (freshness.staleCount <= 0) return [];
    return [impact({
      code: "closing.adjustments_stale",
      source: this.sourceKey,
      status: "action_required",
      severity: "warning",
      title: `${freshness.staleCount} OD à recalculer`,
      message: "Des workpapers, pièces ou écritures sont plus récents que les propositions OD.",
      why: freshness.proposals.filter((proposal) => proposal.stale).flatMap((proposal) => proposal.reasons.map((reason) => reason.label)),
      surfaces: this.surfaces,
      blockingCapabilities: ["approve_closing_adjustment", "close_fiscal_year"],
      affectedArtifacts: freshness.proposals.filter((proposal) => proposal.stale).map((proposal) => proposal.proposalKey),
      primaryAction: { label: "Ouvrir les OD", href: "/cloture/od?tab=review" },
      metadata: { staleCount: freshness.staleCount },
    })];
  }
}

export class EvidenceImpactSource implements ChangeImpactSource {
  readonly sourceKey = "evidence";
  readonly surfaces: ChangeImpactSurface[] = ["documents", "couverture", "cloture", "dossier_ec"];
  constructor(
    private readonly evidence = new EvidenceControlCenter(),
    private readonly storage = new StorageAuditCenter()
  ) {}

  async listImpacts(workspace: CompanyWorkspace, options: ChangeImpactSourceOptions = {}): Promise<ChangeImpact[]> {
    const review = await this.evidence.getEvidenceReview(workspace);
    const impacts: ChangeImpact[] = [];
    if (review.requiredMissing > 0 || review.orphanAttachments > 0 || review.extractionFailures > 0) {
      impacts.push(impact({
        code: "evidence.review",
        source: this.sourceKey,
        status: review.requiredMissing > 0 ? "action_required" : "warning",
        severity: review.requiredMissing > 0 ? "blocking" : "warning",
        title: review.requiredMissing > 0 ? `${review.requiredMissing} pièce(s) requise(s) manquante(s)` : "Justificatifs à revoir",
        message: "Le dossier de preuve contient des exigences non satisfaites ou des pièces à traiter.",
        why: [
          ...(review.requiredMissing > 0 ? [`${review.requiredMissing} pièce(s) requise(s) manquante(s).`] : []),
          ...(review.orphanAttachments > 0 ? [`${review.orphanAttachments} pièce(s) sans rattachement comptable.`] : []),
          ...(review.extractionFailures > 0 ? [`${review.extractionFailures} extraction(s) OCR échouée(s).`] : []),
        ],
        surfaces: this.surfaces,
        blockingCapabilities: review.requiredMissing > 0 ? ["close_fiscal_year"] : [],
        affectedArtifacts: ["Justificatifs"],
        primaryAction: { label: "Ouvrir la revue des pièces", href: "/pieces/revue" },
        metadata: review,
      }));
    }
    if (options.includeDetails || options.surface === "documents" || options.surface === "dossier_ec") {
      const storageAudit = await this.storage.getStorageAudit(workspace);
      if (storageAudit.summary.missing > 0) {
        impacts.push(impact({
          code: "storage.missing_artifacts",
          source: this.sourceKey,
          status: "blocked",
          severity: "blocking",
          title: `${storageAudit.summary.missing} artefact(s) storage manquant(s)`,
          message: "Des fichiers référencés en base ne sont plus disponibles dans le stockage.",
          why: storageAudit.items.filter((item) => !item.available).map((item) => item.filename),
          surfaces: this.surfaces,
          blockingCapabilities: ["generate_documents", "prepare_expert_dossier"],
          affectedArtifacts: storageAudit.items.filter((item) => !item.available).map((item) => item.filename),
          primaryAction: { label: "Ouvrir l'audit storage", href: "/api/storage/audit" },
          metadata: storageAudit.summary,
        }));
      }
    }
    return impacts;
  }
}

export class ExpertDossierImpactSource implements ChangeImpactSource {
  readonly sourceKey = "expert-dossier";
  readonly surfaces: ChangeImpactSurface[] = ["dossier_ec"];
  constructor(
    private readonly snapshots = new DossierSnapshotReviewCenter(),
    private readonly readiness = new ExpertDossierReadinessWorkflow()
  ) {}

  async listImpacts(workspace: CompanyWorkspace): Promise<ChangeImpact[]> {
    const [snapshotState, queue] = await Promise.all([
      this.snapshots.summarizeSnapshotState(workspace),
      this.readiness.getReadinessQueue(workspace),
    ]);
    const impacts: ChangeImpact[] = [];
    if (snapshotState.latest?.freshness.isStale) {
      impacts.push(impact({
        code: "expert_dossier.snapshot_stale",
        source: this.sourceKey,
        status: "action_required",
        severity: "blocking",
        title: "Snapshot EC obsolète",
        message: "Le dossier transmis au cabinet ne reflète plus l'état courant.",
        why: snapshotState.latest.freshness.reasons.map((reason) => reason.label),
        surfaces: this.surfaces,
        blockingCapabilities: ["export_expert_dossier"],
        affectedArtifacts: [snapshotState.latest.snapshotKey],
        primaryAction: { label: "Préparer un nouveau snapshot", href: "/dossier-ec" },
      }));
    }
    if (queue.blockingItems.length > 0) {
      impacts.push(impact({
        code: "expert_dossier.readiness_blocked",
        source: this.sourceKey,
        status: "blocked",
        severity: "blocking",
        title: `${queue.blockingItems.length} blocage(s) dossier EC`,
        message: "Le dossier expert-comptable n'est pas prêt pour l'export final.",
        why: queue.blockingItems.map((item) => item.title),
        surfaces: this.surfaces,
        blockingCapabilities: ["prepare_expert_dossier", "export_expert_dossier"],
        affectedArtifacts: ["Dossier EC"],
        primaryAction: { label: "Ouvrir le dossier EC", href: "/dossier-ec" },
      }));
    }
    return impacts;
  }
}

export class ConnectorImpactSource implements ChangeImpactSource {
  readonly sourceKey = "connectors";
  readonly surfaces: ChangeImpactSurface[] = ["connecteurs"];
  constructor(private readonly openBanking = new OpenBankingFreshnessCenter()) {}

  async listImpacts(workspace: CompanyWorkspace): Promise<ChangeImpact[]> {
    if (workspace.fiscalYear.status === "CLOSED") {
      return [connectorBlocked("connectors.fiscal_year_closed", "Exercice clôturé", "Les synchronisations connecteur sont bloquées sur un exercice clôturé.", workspace.fiscalYear.status)];
    }
    const freshness = await this.openBanking.getFreshness(workspace);
    if (freshness.status === "fresh" || freshness.status === "never_connected") return [];
    return [impact({
      code: "connectors.open_banking_freshness",
      source: this.sourceKey,
      status: "action_required",
      severity: "warning",
      title: "Connexion bancaire à revoir",
      message: "Une connexion bancaire est expirée, révoquée ou à synchroniser.",
      why: freshness.connections.flatMap((connection) => connection.staleReasons),
      surfaces: this.surfaces,
      blockingCapabilities: freshness.connections.some((connection) => connection.status === "expired" || connection.status === "revoked") ? ["sync_connectors"] : [],
      affectedArtifacts: ["Open Banking"],
      primaryAction: { label: "Ouvrir les connecteurs", href: "/connecteurs" },
      metadata: { status: freshness.status },
    })];
  }
}

export class ClosedFiscalYearImpactSource implements ChangeImpactSource {
  readonly sourceKey = "fiscal-year";
  readonly surfaces: ChangeImpactSurface[] = ["dashboard", "imports", "documents", "tva", "cloture", "connecteurs"];

  async listImpacts(workspace: CompanyWorkspace): Promise<ChangeImpact[]> {
    if (workspace.fiscalYear.status !== "CLOSED") return [];
    return [impact({
      code: "fiscal_year.closed",
      source: this.sourceKey,
      status: "blocked",
      severity: "blocking",
      title: "Exercice clôturé",
      message: "Les mutations comptables sont bloquées sur cet exercice.",
      why: ["Active un autre exercice ou rouvre explicitement la clôture avant de modifier les données."],
      surfaces: this.surfaces,
      blockingCapabilities: ["generate_documents", "generate_fec", "generate_vat_declaration", "approve_closing_adjustment", "sync_connectors"],
      affectedArtifacts: [`Exercice ${workspace.fiscalYear.startDate.getFullYear()}`],
      primaryAction: { label: "Changer d'exercice", href: "/exercices" },
    })];
  }
}

export class AutomationImpactSource implements ChangeImpactSource {
  readonly sourceKey = "automation";
  readonly surfaces: ChangeImpactSurface[] = ["dashboard", "imports", "documents", "tva", "cloture", "couverture", "dossier_ec"];

  constructor(private readonly automation = new AutomationOpportunityCenter()) {}

  async listImpacts(workspace: CompanyWorkspace): Promise<ChangeImpact[]> {
    const summary = await this.automation.summarizeAutomationReadiness(workspace);
    if (summary.total === 0) return [];
    return [impact({
      code: "automation.opportunities_available",
      source: this.sourceKey,
      status: summary.validationRequired > 0 || summary.safeRunnable > 0 ? "action_required" : "warning",
      severity: "warning",
      title: "Automatisations disponibles",
      message: `${summary.safeRunnable} automatisation(s) sûre(s), ${summary.suggestions} suggestion(s), ${summary.validationRequired} action(s) à valider.`,
      why: ["Qitus automatise seulement les opérations déterministes et garde les validations comptables dans les workflows métier."],
      surfaces: this.surfaces,
      blockingCapabilities: [],
      affectedArtifacts: ["Imports", "TVA", "Rapprochements", "Documents", "Dossier EC"],
      primaryAction: { label: "Voir le tableau de bord", href: "/dashboard" },
      metadata: summary,
    })];
  }
}

export function defaultChangeImpactSources(): ChangeImpactSource[] {
  return [
    new ClosedFiscalYearImpactSource(),
    new AccountingRulesImpactSource(),
    new ImportLedgerImpactSource(),
    new DocumentImpactSource(),
    new FecImpactSource(),
    new VatImpactSource(),
    new EInvoiceImpactSource(),
    new ReconciliationImpactSource(),
    new ClosingImpactSource(),
    new AutomationImpactSource(),
    new EvidenceImpactSource(),
    new ExpertDossierImpactSource(),
    new ConnectorImpactSource(),
  ];
}

export function sortImpacts(impacts: ChangeImpact[]) {
  return [...impacts].sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || statusRank(b.status) - statusRank(a.status) || a.title.localeCompare(b.title));
}

export function buildChangeImpactOverviewForTest(mode: ChangeImpactsMode, impacts: ChangeImpact[], sourceCount = 0): ChangeImpactOverview {
  const sorted = sortImpacts(impacts);
  return {
    mode,
    status: overviewStatus(sorted),
    generatedAt: new Date().toISOString(),
    total: sorted.length,
    blocking: sorted.filter((item) => item.severity === "blocking").length,
    actionRequired: sorted.filter((item) => item.status === "action_required" || item.status === "blocked").length,
    warning: sorted.filter((item) => item.severity === "warning").length,
    impacts: sorted,
    performanceBudget: { targetMs: 200, sourceCount, durationMs: 0 },
  };
}

export function impact(input: Omit<ChangeImpact, "generatedAt">): ChangeImpact {
  return { ...input, generatedAt: new Date().toISOString() };
}

function connectorBlocked(code: string, title: string, message: string, fiscalYearStatus: FiscalYearStatus) {
  return impact({
    code,
    source: "connectors",
    status: "blocked",
    severity: "blocking",
    title,
    message,
    why: [`Statut exercice : ${fiscalYearStatus}.`],
    surfaces: ["connecteurs"],
    blockingCapabilities: ["sync_connectors"],
    affectedArtifacts: ["Connecteurs"],
    primaryAction: { label: "Ouvrir les exercices", href: "/exercices" },
  });
}

function emptyOverview(mode: ChangeImpactsMode): ChangeImpactOverview {
  return {
    mode,
    status: "ok",
    generatedAt: new Date().toISOString(),
    total: 0,
    blocking: 0,
    actionRequired: 0,
    warning: 0,
    impacts: [],
    performanceBudget: { targetMs: 200, sourceCount: 0, durationMs: 0 },
  };
}

function overviewStatus(impacts: ChangeImpact[]): ChangeImpactStatus {
  if (impacts.some((item) => item.status === "blocked" || item.severity === "blocking")) return "blocked";
  if (impacts.some((item) => item.status === "action_required")) return "action_required";
  if (impacts.some((item) => item.status === "warning" || item.severity === "warning")) return "warning";
  return "ok";
}

function severityRank(severity: ChangeImpactSeverity) {
  if (severity === "blocking") return 3;
  if (severity === "warning") return 2;
  return 1;
}

function statusRank(status: ChangeImpactStatus) {
  if (status === "blocked") return 4;
  if (status === "action_required") return 3;
  if (status === "warning") return 2;
  return 1;
}

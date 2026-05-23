import type { ReconciliationRunKind } from "@prisma/client";
import { assertFiscalYearMutable } from "../annual-closing/annual-closing-center.server";
import { ActivityLogCenter } from "../activity-log/activity-log-center.server";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { DocumentFreshnessCenter } from "../documents/document-freshness-center.server";
import { DocumentGenerationCenter } from "../documents/document-generation-center.server";
import { ExpertDossierReadinessWorkflow } from "../expert-dossier/expert-dossier-readiness-workflow.server";
import { ImportOrchestrator } from "../import-orchestrator/import-orchestrator.server";
import { NotificationCenter } from "../notifications/notification-center.server";
import { BankLineReconciliationCenter } from "../reconciliations/bank-line-reconciliation-center.server";
import { ReconciliationFreshnessCenter } from "../reconciliations/reconciliation-freshness-center.server";
import { StripeReconciliationCenter } from "../reconciliations/stripe-reconciliation-center.server";
import { SuspenseAccountCenter } from "../reconciliations/suspense-account-center.server";
import { ThirdPartyMatchingCenter } from "../reconciliations/third-party-matching-center.server";
import { ExpectedRouteError } from "../route-errors.server";
import { getRuntimeConfig, type AutomationMode } from "../runtime-config.server";
import { VatDeclarationCenter } from "../vat/vat-declaration-center.server";
import { AutomationEligibilityPolicy } from "./automation-eligibility-policy.server";

export type AutomationCategory = 1 | 2 | 3;
export type AutomationEligibilityStatus = "safe" | "needs_validation" | "blocked";
export type AutomationEffectKind = "diagnostic" | "derived_artifact" | "accounting_mutation" | "review_draft";

export type AutomationDomain =
  | "imports"
  | "transactions"
  | "attachments"
  | "tva"
  | "reconciliations"
  | "documents"
  | "expert_dossier"
  | "notifications"
  | "e_invoices"
  | "closing";

export type AutomationOpportunity = {
  opportunityKey: string;
  sourceKey: string;
  domain: AutomationDomain;
  category: AutomationCategory;
  title: string;
  detail: string;
  confidence: number;
  confidenceThreshold: number;
  eligibilityStatus: AutomationEligibilityStatus;
  eligibilityReasons: string[];
  effectKind: AutomationEffectKind;
  safetyChecks?: AutomationSafetyChecks;
  source: string;
  expectedEffect: string;
  reversible: boolean;
  requiresUserValidation: boolean;
  href: string;
  auditEventName: string;
};

export type AutomationSafetyChecks = {
  candidateCount?: number;
  hasCompetingAlternatives?: boolean;
  deterministicSource?: boolean;
  activeRule?: boolean;
  accountResolved?: boolean;
  vatResolvedOrNotApplicable?: boolean;
  balancedEntry?: boolean;
  protectedUserDecision?: boolean;
  conflictReasons?: string[];
};

export type AutomationOpportunityFilters = {
  domain?: AutomationDomain | null;
  category?: AutomationCategory | null;
  limit?: number | null;
};

export type AutomationRunInput = {
  opportunityKeys?: string[];
  domain?: AutomationDomain | null;
};

export type AutomationRunResult = {
  mode: AutomationMode;
  attempted: number;
  completed: number;
  failed: number;
  skipped: number;
  results: Array<{
    opportunityKey: string;
    status: "completed" | "failed" | "skipped";
    title: string;
    message: string;
  }>;
};

export type AutomationReadinessSummary = {
  mode: AutomationMode;
  total: number;
  safeRunnable: number;
  suggestions: number;
  validationRequired: number;
  byDomain: Record<string, number>;
};

export interface AutomationOpportunitySource {
  sourceKey: string;
  listOpportunities(workspace: CompanyWorkspace): Promise<AutomationOpportunity[]>;
  runSafeOpportunity(workspace: CompanyWorkspace, opportunityKey: string): Promise<{ message: string }>;
  explainOpportunity(workspace: CompanyWorkspace, opportunityKey: string): Promise<AutomationOpportunity | null>;
}

export type AutomationOpportunityCenterOptions = {
  sources?: AutomationOpportunitySource[];
  mode?: AutomationMode;
  eligibilityPolicy?: AutomationEligibilityPolicy;
  activity?: ActivityLogCenter;
  assertMutable?: (workspace: CompanyWorkspace) => Promise<void>;
};

export class AutomationOpportunityCenter {
  private readonly sources: AutomationOpportunitySource[];
  private readonly mode: AutomationMode;
  private readonly eligibilityPolicy: AutomationEligibilityPolicy;
  private readonly activity: ActivityLogCenter;
  private readonly assertMutable: (workspace: CompanyWorkspace) => Promise<void>;

  constructor(options: AutomationOpportunityCenterOptions = {}) {
    this.sources = options.sources ?? defaultAutomationOpportunitySources();
    this.mode = options.mode ?? getRuntimeConfig().automationMode;
    this.eligibilityPolicy = options.eligibilityPolicy ?? new AutomationEligibilityPolicy();
    this.activity = options.activity ?? new ActivityLogCenter();
    this.assertMutable = options.assertMutable ?? assertFiscalYearMutable;
  }

  async getOpportunities(workspace: CompanyWorkspace, filters: AutomationOpportunityFilters = {}) {
    if (this.mode === "off") return [];
    const batches = await Promise.all(this.sources.map(async (source) => {
      try {
        return await source.listOpportunities(workspace);
      } catch (error) {
        return [sourceFailureOpportunity(source.sourceKey, error)];
      }
    }));
    const unique = new Map<string, AutomationOpportunity>();
    for (const opportunity of batches.flat()) unique.set(opportunity.opportunityKey, opportunity);
    const filtered = Array.from(unique.values())
      .map((opportunity) => this.eligibilityPolicy.normalize(workspace, opportunity))
      .filter((opportunity) => !filters.domain || opportunity.domain === filters.domain)
      .filter((opportunity) => !filters.category || opportunity.category === filters.category)
      .sort(compareOpportunities);
    return typeof filters.limit === "number" && filters.limit > 0 ? filtered.slice(0, filters.limit) : filtered;
  }

  async getOpportunity(workspace: CompanyWorkspace, opportunityKey: string) {
    const opportunity = (await this.getOpportunities(workspace)).find((candidate) => candidate.opportunityKey === opportunityKey);
    if (!opportunity) throw new ExpectedRouteError("Automatisation introuvable.", 404);
    return opportunity;
  }

  async runSafeAutomations(workspace: CompanyWorkspace, input: AutomationRunInput = {}): Promise<AutomationRunResult> {
    const opportunities = (await this.getOpportunities(workspace, { domain: input.domain, category: 1 }))
      .filter((opportunity) => !input.opportunityKeys?.length || input.opportunityKeys.includes(opportunity.opportunityKey))
      .filter((opportunity) => opportunity.eligibilityStatus === "safe" && !opportunity.requiresUserValidation);
    const initial: AutomationRunResult = { mode: this.mode, attempted: 0, completed: 0, failed: 0, skipped: 0, results: [] };
    if (this.mode === "off" || this.mode === "assistive") {
      return {
        ...initial,
        skipped: opportunities.length,
        results: opportunities.map((opportunity) => ({
          opportunityKey: opportunity.opportunityKey,
          status: "skipped",
          title: opportunity.title,
          message: this.mode === "off" ? "Automatisation désactivée." : "Mode assisté : aucune mutation automatique.",
        })),
      };
    }

    await this.assertMutable(workspace);
    await this.activity.recordActivity(workspace, {
      action: "automation.safe_run_started",
      entityType: "automation",
      entityId: workspace.fiscalYear.id,
      metadata: { mode: this.mode, count: opportunities.length, domain: input.domain ?? null },
    });

    const result: AutomationRunResult = { mode: this.mode, attempted: opportunities.length, completed: 0, failed: 0, skipped: 0, results: [] };
    for (const opportunity of opportunities) {
      const source = this.sources.find((candidate) => candidate.sourceKey === opportunity.sourceKey);
      if (!source) {
        result.skipped += 1;
        result.results.push({ opportunityKey: opportunity.opportunityKey, status: "skipped", title: opportunity.title, message: "Source d'automatisation indisponible." });
        continue;
      }
      try {
        this.eligibilityPolicy.assertRunnable(workspace, opportunity);
        const run = await source.runSafeOpportunity(workspace, opportunity.opportunityKey);
        result.completed += 1;
        result.results.push({ opportunityKey: opportunity.opportunityKey, status: "completed", title: opportunity.title, message: run.message });
        await this.activity.recordActivity(workspace, {
          action: opportunity.auditEventName,
          entityType: "automation",
          entityId: opportunity.opportunityKey,
          metadata: {
            mode: this.mode,
            source: opportunity.source,
            category: opportunity.category,
            confidence: opportunity.confidence,
            confidenceThreshold: opportunity.confidenceThreshold,
            eligibilityStatus: opportunity.eligibilityStatus,
            eligibilityReasons: opportunity.eligibilityReasons,
            effectKind: opportunity.effectKind,
            expectedEffect: opportunity.expectedEffect,
            actualEffect: run.message,
          },
        });
      } catch (error) {
        result.failed += 1;
        result.results.push({ opportunityKey: opportunity.opportunityKey, status: "failed", title: opportunity.title, message: userMessage(error) });
        await this.activity.recordActivity(workspace, {
          action: "automation.safe_run_failed",
          entityType: "automation",
          entityId: opportunity.opportunityKey,
          metadata: { mode: this.mode, title: opportunity.title, message: userMessage(error), source: opportunity.source },
        });
      }
    }
    await this.activity.recordActivity(workspace, {
      action: "automation.safe_run_completed",
      entityType: "automation",
      entityId: workspace.fiscalYear.id,
      metadata: { mode: this.mode, attempted: result.attempted, completed: result.completed, failed: result.failed, skipped: result.skipped },
    });
    return result;
  }

  async summarizeAutomationReadiness(workspace: CompanyWorkspace): Promise<AutomationReadinessSummary> {
    const opportunities = await this.getOpportunities(workspace);
    return summarizeAutomationOpportunities(this.mode, opportunities);
  }
}

export function summarizeAutomationOpportunities(mode: AutomationMode, opportunities: AutomationOpportunity[]): AutomationReadinessSummary {
  return {
    mode,
    total: opportunities.length,
    safeRunnable: opportunities.filter((opportunity) => opportunity.category === 1 && opportunity.eligibilityStatus === "safe" && !opportunity.requiresUserValidation).length,
    suggestions: opportunities.filter((opportunity) => opportunity.category === 2).length,
    validationRequired: opportunities.filter((opportunity) => opportunity.category === 3 || opportunity.requiresUserValidation || opportunity.eligibilityStatus === "needs_validation").length,
    byDomain: opportunities.reduce<Record<string, number>>((acc, opportunity) => {
      acc[opportunity.domain] = (acc[opportunity.domain] ?? 0) + 1;
      return acc;
    }, {}),
  };
}

export function defaultAutomationOpportunitySources(): AutomationOpportunitySource[] {
  return [
    new ImportAutomationSource(),
    new TransactionAutomationSource(),
    new AttachmentAutomationSource(),
    new VatAutomationSource(),
    new ReconciliationAutomationSource(),
    new DocumentAutomationSource(),
    new ClosingAutomationSource(),
    new EInvoiceAutomationSource(),
    new ExpertDossierAutomationSource(),
    new NotificationAutomationSource(),
  ];
}

class ImportAutomationSource implements AutomationOpportunitySource {
  sourceKey = "imports";

  async listOpportunities(workspace: CompanyWorkspace): Promise<AutomationOpportunity[]> {
    const imports = await prisma.import.findMany({
      where: { fiscalYearId: workspace.fiscalYear.id, status: { in: ["ERROR", "REVIEW", "NEEDS_MAPPING"] } },
      orderBy: { updatedAt: "desc" },
      take: 10,
    });
    return imports.flatMap((item) => {
      if (item.status === "NEEDS_MAPPING") {
        return [opportunity({
          key: `import:mapping:${item.id}`,
          sourceKey: this.sourceKey,
          domain: "imports",
          category: 2,
          title: "Colonnes d'import à associer",
          detail: `${item.originalFilename ?? "Import"} attend une association de colonnes avant traitement.`,
          confidence: 0.9,
          effectKind: "diagnostic",
          expectedEffect: "Préparer le parsing CSV sans modifier la comptabilité.",
          reversible: true,
          requiresUserValidation: true,
          href: `/imports/${item.id}/mapping`,
          auditEventName: "import.mapping_suggested",
        })];
      }
      if (item.parsedRows > 0) {
        return [opportunity({
          key: `import:retry-categorization:${item.id}`,
          sourceKey: this.sourceKey,
          domain: "imports",
          category: 1,
          title: "Relancer la catégorisation",
          detail: `${item.originalFilename ?? "Import"} contient ${item.parsedRows} ligne(s) déjà parsée(s).`,
          confidence: 1,
          effectKind: "accounting_mutation",
          expectedEffect: "Rejouer la catégorisation et créer seulement les écritures manquantes.",
          reversible: true,
          requiresUserValidation: false,
          href: "/imports",
          auditEventName: "transaction.auto_categorized",
        })];
      }
      return [opportunity({
        key: `import:retry:${item.id}`,
        sourceKey: this.sourceKey,
        domain: "imports",
        category: 1,
        title: "Relancer l'import technique",
        detail: `${item.originalFilename ?? "Import"} est en erreur avant parsing.`,
        confidence: 1,
        effectKind: "derived_artifact",
        expectedEffect: "Rejouer le parsing du fichier sans supprimer l'import.",
        reversible: true,
        requiresUserValidation: false,
        href: "/imports",
        auditEventName: "automation.safe_run_completed",
      })];
    });
  }

  async runSafeOpportunity(workspace: CompanyWorkspace, opportunityKey: string) {
    const [, action, importId] = splitKey(opportunityKey);
    if (!importId) throw new ExpectedRouteError("Import introuvable pour cette automatisation.", 404);
    if (action === "retry-categorization") {
      await new ImportOrchestrator().retryCategorization(workspace, importId);
      return { message: "Catégorisation relancée." };
    }
    if (action === "retry") {
      await new ImportOrchestrator().retryImport(workspace, importId);
      return { message: "Import relancé." };
    }
    throw new ExpectedRouteError("Automatisation import non exécutable automatiquement.", 409);
  }

  async explainOpportunity(workspace: CompanyWorkspace, opportunityKey: string) {
    return (await this.listOpportunities(workspace)).find((item) => item.opportunityKey === opportunityKey) ?? null;
  }
}

class TransactionAutomationSource implements AutomationOpportunitySource {
  sourceKey = "transactions";

  async listOpportunities(workspace: CompanyWorkspace): Promise<AutomationOpportunity[]> {
    const reviewCount = await prisma.categorization.count({ where: { fiscalYearId: workspace.fiscalYear.id, status: "NEEDS_REVIEW" } });
    if (reviewCount === 0) return [];
    return [opportunity({
      key: "transactions:review-suggestions",
      sourceKey: this.sourceKey,
      domain: "transactions",
      category: 2,
      title: "Suggestions de catégorisation à examiner",
      detail: `${reviewCount} transaction(s) peuvent recevoir une suggestion explicable, mais demandent une validation utilisateur.`,
      confidence: 0.65,
      effectKind: "review_draft",
      expectedEffect: "Réduire les transactions à vérifier sans écriture automatique ambiguë.",
      reversible: true,
      requiresUserValidation: true,
      href: "/transactions?status=review",
      auditEventName: "transaction.auto_categorized",
    })];
  }

  async runSafeOpportunity(): Promise<{ message: string }> {
    throw new ExpectedRouteError("Les suggestions transactionnelles nécessitent une validation utilisateur.", 409);
  }

  async explainOpportunity(workspace: CompanyWorkspace, opportunityKey: string) {
    return (await this.listOpportunities(workspace)).find((item) => item.opportunityKey === opportunityKey) ?? null;
  }
}

class AttachmentAutomationSource implements AutomationOpportunitySource {
  sourceKey = "attachments";

  async listOpportunities(workspace: CompanyWorkspace): Promise<AutomationOpportunity[]> {
    const unmatched = await prisma.attachment.count({
      where: {
        companyId: workspace.company.id,
        fiscalYearId: workspace.fiscalYear.id,
        links: { none: {} },
        archivedAt: null,
      },
    });
    if (unmatched === 0) return [];
    return [opportunity({
      key: "attachments:match-suggestions",
      sourceKey: this.sourceKey,
      domain: "attachments",
      category: 2,
      title: "Pièces à rapprocher",
      detail: `${unmatched} pièce(s) peuvent être proposées en rapprochement avec une transaction ou une écriture.`,
      confidence: 0.7,
      effectKind: "review_draft",
      expectedEffect: "Afficher les meilleurs liens probables sans rattachement automatique.",
      reversible: true,
      requiresUserValidation: true,
      href: "/pieces",
      auditEventName: "attachment.link_suggested",
    })];
  }

  async runSafeOpportunity(): Promise<{ message: string }> {
    throw new ExpectedRouteError("Les rattachements de pièces proposés doivent être validés.", 409);
  }

  async explainOpportunity(workspace: CompanyWorkspace, opportunityKey: string) {
    return (await this.listOpportunities(workspace)).find((item) => item.opportunityKey === opportunityKey) ?? null;
  }
}

class VatAutomationSource implements AutomationOpportunitySource {
  sourceKey = "tva";

  async listOpportunities(workspace: CompanyWorkspace): Promise<AutomationOpportunity[]> {
    const center = new VatDeclarationCenter();
    const review = await center.getVatReview(workspace);
    if (review.status === "not_applicable" || review.blockingCount > 0) return [];
    const actionable = review.controls.find((control) => control.code === "VAT_DECLARATION_MISSING" || control.code === "VAT_DECLARATION_STALE");
    if (!actionable) return [];
    return [opportunity({
      key: "tva:generate-draft",
      sourceKey: this.sourceKey,
      domain: "tva",
      category: 1,
      title: "Générer le brouillon TVA",
      detail: actionable.detail,
      confidence: 1,
      effectKind: "derived_artifact",
      expectedEffect: "Créer un brouillon CA3/CA12 sans télédéclaration ni paiement.",
      reversible: true,
      requiresUserValidation: false,
      href: "/tva",
      auditEventName: "vat.declaration_draft_auto_generated",
    })];
  }

  async runSafeOpportunity(workspace: CompanyWorkspace) {
    const result = await new VatDeclarationCenter().generateDraft(workspace);
    await new ActivityLogCenter().recordActivity(workspace, {
      action: "vat.declaration_draft_auto_generated",
      entityType: "vat_declaration",
      entityId: result.declaration.id,
      metadata: { mode: getRuntimeConfig().automationMode, source: this.sourceKey },
    });
    return { message: "Brouillon TVA généré." };
  }

  async explainOpportunity(workspace: CompanyWorkspace, opportunityKey: string) {
    return (await this.listOpportunities(workspace)).find((item) => item.opportunityKey === opportunityKey) ?? null;
  }
}

class ReconciliationAutomationSource implements AutomationOpportunitySource {
  sourceKey = "reconciliations";

  async listOpportunities(workspace: CompanyWorkspace): Promise<AutomationOpportunity[]> {
    const freshness = await new ReconciliationFreshnessCenter().getFreshness(workspace);
    return (["BANK", "STRIPE", "THIRD_PARTY", "SUSPENSE"] as ReconciliationRunKind[])
      .map((kind) => freshness.runs[kind])
      .filter((run) => run.status !== "fresh")
      .map((run) => opportunity({
        key: `reconciliation:run:${run.kind}`,
        sourceKey: this.sourceKey,
        domain: "reconciliations",
        category: 1,
        title: `Relancer le rapprochement ${reconciliationKindLabel(run.kind)}`,
        detail: run.staleReasons[0] ?? "Le rapprochement doit être calculé.",
        confidence: 1,
        effectKind: "derived_artifact",
        expectedEffect: "Calculer les matches exacts et laisser les écarts en revue.",
        reversible: true,
        requiresUserValidation: false,
        href: "/rapprochements",
        auditEventName: "reconciliation.auto_matched",
      }));
  }

  async runSafeOpportunity(workspace: CompanyWorkspace, opportunityKey: string) {
    const kind = splitKey(opportunityKey)[2] as ReconciliationRunKind | undefined;
    if (kind === "BANK") await new BankLineReconciliationCenter().runBankMatching(workspace);
    else if (kind === "STRIPE") await new StripeReconciliationCenter().runStripeMatching(workspace);
    else if (kind === "THIRD_PARTY") await new ThirdPartyMatchingCenter().runThirdPartyMatching(workspace);
    else if (kind === "SUSPENSE") await new SuspenseAccountCenter().summarizeSuspenseAccounts(workspace);
    else throw new ExpectedRouteError("Rapprochement inconnu.", 404);
    await new ActivityLogCenter().recordActivity(workspace, {
      action: "reconciliation.auto_matched",
      entityType: "reconciliation",
      entityId: kind,
      metadata: { mode: getRuntimeConfig().automationMode, kind },
    });
    return { message: `Rapprochement ${reconciliationKindLabel(kind)} relancé.` };
  }

  async explainOpportunity(workspace: CompanyWorkspace, opportunityKey: string) {
    return (await this.listOpportunities(workspace)).find((item) => item.opportunityKey === opportunityKey) ?? null;
  }
}

class DocumentAutomationSource implements AutomationOpportunitySource {
  sourceKey = "documents";

  async listOpportunities(workspace: CompanyWorkspace): Promise<AutomationOpportunity[]> {
    const freshness = await new DocumentFreshnessCenter().getFreshness(workspace);
    const hasEntries = await prisma.journalEntry.count({ where: { fiscalYearId: workspace.fiscalYear.id } });
    if (hasEntries === 0) return [];
    const hasCoreDocuments = await prisma.document.count({ where: { fiscalYearId: workspace.fiscalYear.id, type: { in: ["FEC", "BALANCE", "BILAN", "COMPTE_RESULTAT"] } } });
    if (freshness.staleCount === 0 && hasCoreDocuments > 0) return [];
    return [opportunity({
      key: "documents:regenerate-core",
      sourceKey: this.sourceKey,
      domain: "documents",
      category: 1,
      title: hasCoreDocuments > 0 ? "Régénérer les documents comptables" : "Générer les documents comptables",
      detail: freshness.staleCount > 0 ? `${freshness.staleCount} document(s) à régénérer.` : "Les écritures sont disponibles pour générer FEC, balance et états.",
      confidence: 1,
      effectKind: "derived_artifact",
      expectedEffect: "Produire FEC, balance, bilan et compte de résultat si le journal est exportable.",
      reversible: true,
      requiresUserValidation: false,
      href: "/documents",
      auditEventName: "document.auto_regenerated",
    })];
  }

  async runSafeOpportunity(workspace: CompanyWorkspace) {
    const documents = await new DocumentGenerationCenter().generateDocuments(workspace, { types: ["fec", "statements"] });
    await new ActivityLogCenter().recordActivity(workspace, {
      action: "document.auto_regenerated",
      entityType: "document",
      entityId: workspace.fiscalYear.id,
      metadata: { mode: getRuntimeConfig().automationMode, count: documents.length, types: documents.map((document) => document.type) },
    });
    return { message: `${documents.length} document(s) généré(s).` };
  }

  async explainOpportunity(workspace: CompanyWorkspace, opportunityKey: string) {
    return (await this.listOpportunities(workspace)).find((item) => item.opportunityKey === opportunityKey) ?? null;
  }
}

class ClosingAutomationSource implements AutomationOpportunitySource {
  sourceKey = "closing";

  async listOpportunities(workspace: CompanyWorkspace): Promise<AutomationOpportunity[]> {
    const ready = await prisma.closingWorkpaper.count({ where: { fiscalYearId: workspace.fiscalYear.id, status: "READY" } });
    if (ready === 0) return [];
    return [opportunity({
      key: "closing:generate-proposals",
      sourceKey: this.sourceKey,
      domain: "closing",
      category: 3,
      title: "Propositions OD à générer",
      detail: `${ready} feuille(s) de travail prête(s) peuvent produire des propositions d'OD.`,
      confidence: 1,
      effectKind: "review_draft",
      expectedEffect: "Créer ou mettre à jour des brouillons OD. Validation utilisateur obligatoire avant écriture.",
      reversible: true,
      requiresUserValidation: true,
      href: "/cloture/od",
      auditEventName: "closing_adjustment.draft_auto_generated",
    })];
  }

  async runSafeOpportunity(): Promise<{ message: string }> {
    throw new ExpectedRouteError("Les propositions OD restent dans le workflow de clôture et exigent validation.", 409);
  }

  async explainOpportunity(workspace: CompanyWorkspace, opportunityKey: string) {
    return (await this.listOpportunities(workspace)).find((item) => item.opportunityKey === opportunityKey) ?? null;
  }
}

class EInvoiceAutomationSource implements AutomationOpportunitySource {
  sourceKey = "e_invoices";

  async listOpportunities(workspace: CompanyWorkspace): Promise<AutomationOpportunity[]> {
    const invoices = await prisma.eInvoice.findMany({
      where: {
        fiscalYearId: workspace.fiscalYear.id,
        status: { in: ["PARSED", "MATCHED"] },
        accountingDrafts: { none: { status: { in: ["DRAFT", "READY", "APPROVED"] } } },
      },
      take: 10,
      orderBy: { updatedAt: "desc" },
    });
    return invoices.map((invoice) => opportunity({
      key: `e_invoice:create-draft:${invoice.id}`,
      sourceKey: this.sourceKey,
      domain: "e_invoices",
      category: 3,
      title: "Brouillon comptable facture à préparer",
      detail: `${invoice.supplierName ?? "Facture fournisseur"} peut recevoir un brouillon comptable à relire.`,
      confidence: 0.95,
      effectKind: "review_draft",
      expectedEffect: "Préparer un brouillon équilibré sans créer d'écriture avant approbation.",
      reversible: true,
      requiresUserValidation: true,
      href: `/factures-entrantes/${invoice.id}`,
      auditEventName: "e_invoice.accounting_draft_auto_generated",
    }));
  }

  async runSafeOpportunity(): Promise<{ message: string }> {
    throw new ExpectedRouteError("Les brouillons de facture demandent une revue utilisateur avant écriture.", 409);
  }

  async explainOpportunity(workspace: CompanyWorkspace, opportunityKey: string) {
    return (await this.listOpportunities(workspace)).find((item) => item.opportunityKey === opportunityKey) ?? null;
  }
}

class ExpertDossierAutomationSource implements AutomationOpportunitySource {
  sourceKey = "expert_dossier";

  async listOpportunities(workspace: CompanyWorkspace): Promise<AutomationOpportunity[]> {
    const queue = await new ExpertDossierReadinessWorkflow().getReadinessQueue(workspace).catch(() => null);
    if (!queue || queue.blockingItems.length > 0) return [];
    return [opportunity({
      key: "expert_dossier:prepare-snapshot",
      sourceKey: this.sourceKey,
      domain: "expert_dossier",
      category: 1,
      title: "Préparer l'état transmis EC",
      detail: queue.warnings.length > 0 ? `${queue.warnings.length} avertissement(s), aucun blocage.` : "Le dossier peut être figé sans partage automatique.",
      confidence: 1,
      effectKind: "derived_artifact",
      expectedEffect: "Créer un snapshot local du dossier. Aucun partage cabinet automatique.",
      reversible: true,
      requiresUserValidation: false,
      href: "/dossier-ec",
      auditEventName: "expert_dossier.snapshot_auto_prepared",
    })];
  }

  async runSafeOpportunity(workspace: CompanyWorkspace) {
    const prepared = await new ExpertDossierReadinessWorkflow().prepareForReview(workspace);
    await new ActivityLogCenter().recordActivity(workspace, {
      action: "expert_dossier.snapshot_auto_prepared",
      entityType: "dossier_snapshot",
      entityId: prepared.snapshot.id,
      metadata: { mode: getRuntimeConfig().automationMode },
    });
    return { message: "État transmis EC préparé." };
  }

  async explainOpportunity(workspace: CompanyWorkspace, opportunityKey: string) {
    return (await this.listOpportunities(workspace)).find((item) => item.opportunityKey === opportunityKey) ?? null;
  }
}

class NotificationAutomationSource implements AutomationOpportunitySource {
  sourceKey = "notifications";

  async listOpportunities(workspace: CompanyWorkspace): Promise<AutomationOpportunity[]> {
    const notifications = await prisma.notification.count({
      where: {
        companyId: workspace.company.id,
        fiscalYearId: workspace.fiscalYear.id,
        dismissedAt: null,
        expiresAt: null,
      },
    });
    if (notifications === 0) return [];
    return [opportunity({
      key: "notifications:refresh",
      sourceKey: this.sourceKey,
      domain: "notifications",
      category: 1,
      title: "Nettoyer les notifications obsolètes",
      detail: "Les notifications dont la cause a disparu peuvent être expirées automatiquement.",
      confidence: 1,
      effectKind: "diagnostic",
      expectedEffect: "Rafraîchir les notifications sans marquer comme lues les alertes encore actives.",
      reversible: true,
      requiresUserValidation: false,
      href: "/notifications",
      auditEventName: "automation.safe_run_completed",
    })];
  }

  async runSafeOpportunity(workspace: CompanyWorkspace) {
    const refreshed = await new NotificationCenter().refreshNotifications(workspace);
    return { message: `${refreshed.length} notification(s) active(s) après nettoyage.` };
  }

  async explainOpportunity(workspace: CompanyWorkspace, opportunityKey: string) {
    return (await this.listOpportunities(workspace)).find((item) => item.opportunityKey === opportunityKey) ?? null;
  }
}

export interface AISuggestionAdapter {
  suggest(input: { text: string; context?: Record<string, unknown> }): Promise<AISuggestion>;
}

export type AISuggestion = {
  title: string;
  rationale: string;
  confidence: number;
  sources: string[];
  recommendedAction: string;
  requiresUserValidation: true;
};

function opportunity(input: {
  key: string;
  sourceKey: string;
  domain: AutomationDomain;
  category: AutomationCategory;
  title: string;
  detail: string;
  confidence: number;
  effectKind: AutomationEffectKind;
  safetyChecks?: AutomationSafetyChecks;
  expectedEffect: string;
  reversible: boolean;
  requiresUserValidation: boolean;
  href: string;
  auditEventName: string;
}): AutomationOpportunity {
  return {
    opportunityKey: input.key,
    sourceKey: input.sourceKey,
    domain: input.domain,
    category: input.category,
    title: input.title,
    detail: input.detail,
    confidence: input.confidence,
    confidenceThreshold: 1,
    eligibilityStatus: input.category === 1 ? "safe" : "needs_validation",
    eligibilityReasons: [],
    effectKind: input.effectKind,
    safetyChecks: input.safetyChecks,
    source: input.sourceKey,
    expectedEffect: input.expectedEffect,
    reversible: input.reversible,
    requiresUserValidation: input.requiresUserValidation,
    href: input.href,
    auditEventName: input.auditEventName,
  };
}

function sourceFailureOpportunity(sourceKey: string, error: unknown): AutomationOpportunity {
  return opportunity({
    key: `automation:source-error:${sourceKey}`,
    sourceKey,
    domain: "notifications",
    category: 2,
    title: "Diagnostic d'automatisation indisponible",
    detail: userMessage(error),
    confidence: 1,
    effectKind: "diagnostic",
    expectedEffect: "Afficher l'erreur sans bloquer les autres diagnostics.",
    reversible: true,
    requiresUserValidation: true,
    href: "/activity",
    auditEventName: "automation.safe_run_failed",
  });
}

function compareOpportunities(a: AutomationOpportunity, b: AutomationOpportunity) {
  const category = a.category - b.category;
  if (category !== 0) return category;
  if (a.requiresUserValidation !== b.requiresUserValidation) return a.requiresUserValidation ? 1 : -1;
  return b.confidence - a.confidence || a.title.localeCompare(b.title, "fr");
}

function splitKey(key: string) {
  return key.split(":");
}

function userMessage(error: unknown) {
  if (error instanceof ExpectedRouteError) return error.message;
  if (error instanceof Error) return error.message.split("\n")[0];
  return String(error);
}

function reconciliationKindLabel(kind: ReconciliationRunKind | undefined) {
  if (kind === "BANK") return "bancaire";
  if (kind === "STRIPE") return "Stripe";
  if (kind === "THIRD_PARTY") return "tiers";
  if (kind === "SUSPENSE") return "comptes d'attente";
  return "inconnu";
}

import { Prisma, type ActivityLog } from "@prisma/client";
import { prisma } from "../db.server";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { sanitizeUserFacingText } from "../product-language/product-language";

export type ActivityEvent = {
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
};

export type ActivityLogFilters = {
  type?: string | null;
  action?: string | null;
  userId?: string | null;
  fiscalYearId?: string | null;
  from?: string | null;
  to?: string | null;
  limit?: number;
  page?: number;
  pageSize?: number;
};

export type ActivityLogSummary = {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: unknown;
  createdAt: string;
  fiscalYearId?: string | null;
  userId?: string | null;
};

export type ActivityTimelineItem = ActivityLogSummary & {
  label: string;
  detail: string;
  metadataText: string;
};

export class ActivityLogCenter {
  async recordActivity(workspace: CompanyWorkspace, event: ActivityEvent) {
    return prisma.activityLog.create({
      data: {
        companyId: workspace.company.id,
        fiscalYearId: workspace.fiscalYear.id,
        userId: workspace.user.id,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        metadata: event.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async listActivity(workspace: CompanyWorkspace, filters: ActivityLogFilters = {}): Promise<ActivityLogSummary[]> {
    const rows = await prisma.activityLog.findMany({
      where: {
        companyId: workspace.company.id,
        entityType: filters.type || undefined,
        action: filters.action || undefined,
        userId: filters.userId || undefined,
        fiscalYearId: filters.fiscalYearId || workspace.fiscalYear.id,
        createdAt: dateRange(filters),
      },
      orderBy: { createdAt: "desc" },
      skip: offset(filters),
      take: pageSize(filters),
    });
    return rows.map(summarizeActivity);
  }

  async exportActivityCsv(workspace: CompanyWorkspace, filters: ActivityLogFilters = {}) {
    const rows = await this.listActivity(workspace, { ...filters, limit: filters.limit ?? 1000 });
    return [
      "createdAt,fiscalYearId,userId,action,entityType,entityId,metadata",
      ...rows.map((row) => [
        row.createdAt,
        csv(row.fiscalYearId ?? ""),
        csv(row.userId ?? ""),
        csv(row.action),
        csv(row.entityType ?? ""),
        csv(row.entityId ?? ""),
        csv(JSON.stringify(row.metadata ?? {})),
      ].join(",")),
    ].join("\n");
  }

  async getTimeline(workspace: CompanyWorkspace, filters: ActivityLogFilters = {}): Promise<ActivityTimelineItem[]> {
    const rows = await this.listActivity(workspace, filters);
    return rows.map(toTimelineItem);
  }
}

function summarizeActivity(row: ActivityLog): ActivityLogSummary {
  return {
    id: row.id,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
      metadata: row.metadata,
      createdAt: row.createdAt.toISOString(),
      fiscalYearId: row.fiscalYearId,
      userId: row.userId,
  };
}

function csv(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

export function toTimelineItem(row: ActivityLogSummary): ActivityTimelineItem {
  return {
    ...row,
    label: activityLabel(row.action),
    detail: activityDetail(row),
    metadataText: compactMetadata(row.metadata),
  };
}

function activityLabel(action: string) {
  const labels: Record<string, string> = {
    "import.started": "Import lancé",
    "import.queued": "Import mis en file",
    "import.step_started": "Étape import démarrée",
    "import.step_completed": "Étape import terminée",
    "import.step_failed": "Étape import échouée",
    "import.mapping_submitted": "Correspondance de colonnes enregistrée",
    "import.retry_requested": "Relance de l'import demandée",
    "import.retry_categorization_requested": "Relance de la catégorisation demandée",
    "import.completed": "Import terminé",
    "import.failed": "Import échoué",
    "import.deleted": "Import supprimé",
    "import.reset_requested": "Réinitialisation imports demandée",
    "import.reset_completed": "Réinitialisation imports terminée",
    "transaction.categorized": "Transaction corrigée",
    "accounting_review.viewed": "Contrôle comptable consulté",
    "accounting_review.blocker_resolved": "Blocage comptable levé",
    "accounting_issue.resolved": "Point de contrôle résolu",
    "accounting_issue.ignored": "Point de contrôle ignoré",
    "accounting_issue.reopened": "Point de contrôle rouvert",
    "accounting_issue.note_updated": "Note de contrôle modifiée",
    "correction_rule.created": "Règle de correction créée",
    "correction_rule.updated": "Règle de correction modifiée",
    "correction_rule.disabled": "Règle de correction désactivée",
    "closing_adjustment.proposed": "OD proposée",
    "closing_adjustment.assumptions_updated": "Hypothèses OD modifiées",
    "closing_adjustment.recalculated": "OD recalculée",
    "closing_adjustment.approved": "OD validée",
    "closing_adjustment.rejected": "OD rejetée",
    "closing_adjustment.skipped": "OD ignorée",
    "closing_adjustment.generated": "OD de clôture générée",
    "closing_adjustment.required_missing": "OD requise manquante",
    "closing_adjustment.ready_for_review": "OD prête à relire",
    "closing_adjustment.reopened": "OD réouverte",
    "closing_adjustment.stale": "OD à mettre à jour",
    "closing_adjustment.recalculated_stale": "OD mises à jour recalculées",
    "closing_adjustment.approval_blocked_missing_evidence": "Validation OD bloquée par pièce manquante",
    "closing_workpaper.created": "Feuille de travail de clôture créée",
    "closing_workpaper.updated": "Feuille de travail de clôture modifiée",
    "closing_workpaper.archived": "Feuille de travail de clôture archivée",
    "closing_workpaper.marked_ready": "Feuille de travail marquée prête",
    "closing_workpaper.marked_draft": "Feuille de travail remise en brouillon",
    "document.marked_stale": "Documents à régénérer",
    "document_generation.attempted": "Génération document lancée",
    "document_generation.succeeded": "Audit génération réussi",
    "document_generation.failed": "Audit génération échoué",
    "document.generated": "Document généré",
    "document.generated_with_warnings": "Document généré avec avertissements",
    "document.blocked": "Génération document bloquée",
    "document.failed": "Document échoué",
    "document.downloaded": "Document téléchargé",
    "document.evidence_bundle_downloaded": "Dossier de preuves téléchargé",
    "attachment.uploaded": "Pièce déposée",
    "attachment.extracted": "Lecture de pièce terminée",
    "attachment.extraction_failed": "Lecture de pièce impossible",
    "attachment.linked": "Pièce rattachée",
    "attachment.unlinked": "Pièce détachée",
    "attachment.archived": "Pièce archivée",
    "attachment.manual_extraction_updated": "Informations de pièce modifiées",
    "annual_closing.started": "Clôture démarrée",
    "annual_closing.step_completed": "Étape de clôture terminée",
    "annual_closing.step_blocked": "Étape de clôture bloquée",
    "annual_closing.step_reopened": "Étape de clôture rouverte",
    "annual_closing.closed": "Exercice clôturé",
    "annual_closing.reopened": "Exercice rouvert",
    "fixed_asset.created": "Immobilisation créée",
    "fixed_asset.updated": "Immobilisation modifiée",
    "fixed_asset.archived": "Immobilisation archivée",
    "bank_reconciliation.saved": "Solde bancaire saisi",
    "bank_reconciliation.confirmed": "Rapprochement bancaire confirmé",
    "reconciliation.bank_run": "Rapprochement bancaire lancé",
    "reconciliation.bank_balance_saved": "Solde bancaire de rapprochement saisi",
    "reconciliation.bank_match_confirmed": "Match bancaire confirmé",
    "reconciliation.bank_match_ignored": "Match bancaire ignoré",
    "reconciliation.stripe_fixture_imported": "Données de test Stripe importées",
    "reconciliation.stripe_synced": "Synchronisation Stripe lancée",
    "reconciliation.stripe_run": "Rapprochement Stripe lancé",
    "reconciliation.third_party_run": "Lettrage tiers lancé",
    "reconciliation.suspense_resolved": "Compte d'attente traité",
    "reconciliation.issue_resolved": "Point de rapprochement résolu",
    "reconciliation.issue_ignored": "Point de rapprochement ignoré",
    "reconciliation.issue_reopened": "Point de rapprochement rouvert",
    "reconciliation.report_generated": "Rapport de rapprochement généré",
    "expert_review.share_created": "Lien expert-comptable créé",
    "expert_review.share_revoked": "Lien expert-comptable révoqué",
    "expert_review.started": "Revue expert-comptable démarrée",
    "expert_review.item_created": "Demande expert-comptable créée",
    "expert_review.item_answered": "Demande expert-comptable répondue",
    "expert_review.comment_added": "Commentaire expert-comptable ajouté",
    "expert_review.item_resolved": "Demande expert-comptable résolue",
    "expert_review.item_waived": "Demande expert-comptable ignorée avec note",
    "expert_review.item_reopened": "Demande expert-comptable rouverte",
    "expert_review.changes_requested": "Changements demandés par l'expert-comptable",
    "expert_review.final_signed_off": "Dossier signé par l'expert-comptable",
    "expert_review.validated": "Dossier validé par l'expert-comptable",
    "expert_dossier.snapshot_created": "État du dossier EC enregistré",
    "expert_dossier.prepared_for_review": "Dossier EC préparé pour revue",
    "expert_dossier.exported": "Dossier EC exporté",
    "chat.message_sent": "Message chat envoyé",
    "chat.reply_generated": "Réponse chat générée",
    "chat.reply_failed": "Réponse chat échouée",
    "billing.checkout_started": "Checkout abonnement démarré",
    "billing.portal_opened": "Portail abonnement ouvert",
    "billing.subscription_updated": "Abonnement mis à jour",
    "billing.webhook_failed": "Notification abonnement échouée",
    "usage.limit_reached": "Limite d'usage atteinte",
    "notification.read": "Notification lue",
    "notification.read_all": "Notifications lues",
    "notification.dismissed": "Notification masquée",
    "fiscal_year.created": "Exercice créé",
    "privacy.export_requested": "Export RGPD demandé",
    "privacy.exported": "Export RGPD généré",
    "privacy.soft_deleted": "Suppression demandée",
    "privacy.anonymized": "Données anonymisées",
    "privacy.purged": "Données purgées",
    "regulatory_freshness.checked": "Fraîcheur réglementaire vérifiée",
    "accounting_rule_update.applied": "Règles comptables appliquées",
    "accounting_rule_update.impacts_refreshed": "Impacts des règles comptables actualisés",
    "profile.updated": "Profil modifié",
    "profile.onboarding_completed": "Onboarding terminé",
    "vat.declaration_generated": "Déclaration TVA générée",
    "vat.declaration_superseded": "Déclaration TVA remplacée",
    "vat.declaration_downloaded": "Déclaration TVA téléchargée",
    "vat.declaration_blocked": "Déclaration TVA bloquée",
    "vat.issue_resolved": "Point TVA résolu",
    "webhook.clerk_user_synced": "Utilisateur synchronisé",
    "monitoring.metric_recorded": "Métrique enregistrée",
    "cron.notifications_refreshed": "Notifications rafraîchies",
    "open_banking.consent_started": "Connexion bancaire démarrée",
    "open_banking.consent_completed": "Connexion bancaire confirmée",
    "open_banking.consent_revoked": "Connexion bancaire révoquée",
    "open_banking.consent_reconnected": "Connexion bancaire renouvelée",
    "open_banking.webhook_processed": "Notification Open Banking traitée",
    "open_banking.sync_completed": "Synchronisation bancaire terminée",
    "open_banking.sync_failed": "Synchronisation bancaire échouée",
    "automation.safe_run_started": "Automatisation sûre lancée",
    "automation.safe_run_completed": "Automatisation sûre terminée",
    "automation.safe_run_failed": "Automatisation sûre échouée",
    "transaction.auto_categorized": "Transaction catégorisée automatiquement",
    "attachment.link_suggested": "Rattachement pièce suggéré",
    "vat.declaration_draft_auto_generated": "Brouillon TVA généré automatiquement",
    "document.auto_regenerated": "Document régénéré automatiquement",
    "reconciliation.auto_matched": "Match de rapprochement automatique",
    "closing_adjustment.draft_auto_generated": "Brouillon OD généré automatiquement",
    "e_invoice.accounting_draft_auto_generated": "Brouillon facture généré automatiquement",
    "expert_dossier.snapshot_auto_prepared": "État transmis EC préparé automatiquement",
  };
  return labels[action] ?? sanitizeUserFacingText(action.replaceAll("_", " ").replaceAll(".", " "));
}

function activityDetail(row: ActivityLogSummary) {
  const metadata = row.metadata as Record<string, unknown> | null;
  if (row.action.startsWith("document.") && Array.isArray(metadata?.filenames)) return metadata.filenames.join(", ");
  if (row.action.startsWith("attachment.") && typeof metadata?.filename === "string") return metadata.filename;
  if (row.action === "document.downloaded" && typeof metadata?.filename === "string") return metadata.filename;
  if (row.action === "document.evidence_bundle_downloaded" && typeof metadata?.filename === "string") return metadata.filename;
  if (row.action.startsWith("document_generation.") && Array.isArray(metadata?.filenames)) return metadata.filenames.join(", ");
  if (row.action.startsWith("document_generation.") && Array.isArray(metadata?.types)) return metadata.types.join(", ");
  if (row.action.startsWith("annual_closing.") && typeof metadata?.title === "string") return metadata.title;
  if (row.action.startsWith("annual_closing.") && typeof metadata?.reason === "string") return metadata.reason;
  if (row.action.startsWith("fixed_asset.") && typeof metadata?.label === "string") return metadata.label;
  if (row.action.startsWith("bank_reconciliation.") && typeof metadata?.status === "string") return metadata.status;
  if (row.action.startsWith("reconciliation.") && typeof metadata?.kind === "string") return metadata.kind;
  if (row.action.startsWith("reconciliation.") && typeof metadata?.status === "string") return metadata.status;
  if (row.action.startsWith("expert_review.") && typeof metadata?.reviewerName === "string") return metadata.reviewerName;
  if (row.action.startsWith("expert_review.") && typeof metadata?.label === "string") return metadata.label;
  if (row.action.startsWith("expert_review.") && typeof metadata?.title === "string") return metadata.title;
  if (row.action.startsWith("expert_dossier.") && typeof metadata?.status === "string") return metadata.status;
  if (row.action.startsWith("chat.") && typeof metadata?.provider === "string") return sanitizeUserFacingText(metadata.provider);
  if (row.action.startsWith("billing.") && typeof metadata?.tier === "string") return metadata.tier;
  if (row.action.startsWith("usage.") && typeof metadata?.capability === "string") return metadata.capability;
  if (row.action.startsWith("notification.") && typeof metadata?.type === "string") return metadata.type;
  if (row.action.startsWith("fiscal_year.") && typeof metadata?.startDate === "string") return metadata.startDate;
  if (row.action.startsWith("privacy.") && typeof metadata?.kind === "string") return metadata.kind;
  if (row.action.startsWith("regulatory_freshness.") && typeof metadata?.source === "string") return metadata.source;
  if (row.action.startsWith("accounting_rule_update.") && typeof metadata?.status === "string") return metadata.status;
  if (row.action.startsWith("accounting_rule_update.") && typeof metadata?.affectedTransactionCount === "number") return `${metadata.affectedTransactionCount} transaction(s) concernée(s)`;
  if (row.action.startsWith("correction_rule.") && typeof metadata?.counterparty === "string") return metadata.counterparty;
  if (row.action.startsWith("closing_adjustment.") && typeof metadata?.label === "string") return metadata.label;
  if (row.action.startsWith("import.") && typeof metadata?.filename === "string") return metadata.filename;
  if (row.action.startsWith("import.") && typeof metadata?.importCount === "number") return `${metadata.importCount} import(s)`;
  if (row.action.startsWith("profile.") && typeof metadata?.name === "string") return metadata.name;
  if (row.action.startsWith("vat.") && typeof metadata?.filename === "string") return metadata.filename;
  if (row.action.startsWith("vat.") && typeof metadata?.issueKey === "string") return metadata.issueKey;
  if (row.action.startsWith("vat.") && typeof metadata?.type === "string") return metadata.type;
  if (row.action.startsWith("webhook.") && typeof metadata?.type === "string") return metadata.type;
  if (row.action.startsWith("open_banking.") && typeof metadata?.provider === "string") return sanitizeUserFacingText(metadata.provider);
  if (row.action.startsWith("open_banking.") && typeof metadata?.message === "string") return sanitizeUserFacingText(metadata.message);
  if (row.action.startsWith("automation.") && typeof metadata?.title === "string") return metadata.title;
  if (row.action.startsWith("automation.") && typeof metadata?.count === "number") return `${metadata.count} opportunité(s)`;
  if (row.action.startsWith("automation.") && typeof metadata?.attempted === "number") return `${metadata.attempted} tentative(s)`;
  if (row.action === "transaction.auto_categorized" && typeof metadata?.source === "string") return metadata.source;
  if (row.action === "document.auto_regenerated" && Array.isArray(metadata?.types)) return metadata.types.join(", ");
  if (row.action.startsWith("monitoring.") && typeof metadata?.name === "string") return metadata.name;
  if (row.action.startsWith("cron.") && typeof metadata?.count === "number") return `${metadata.count}`;
  return row.entityId ?? "";
}

function dateRange(filters: ActivityLogFilters) {
  if (!filters.from && !filters.to) return undefined;
  return {
    gte: filters.from ? new Date(filters.from) : undefined,
    lte: filters.to ? new Date(filters.to) : undefined,
  };
}

function pageSize(filters: ActivityLogFilters) {
  const value = filters.pageSize ?? filters.limit ?? 100;
  return Math.min(Math.max(value, 1), 1000);
}

function offset(filters: ActivityLogFilters) {
  const page = Math.max(filters.page ?? 1, 1);
  return (page - 1) * pageSize(filters);
}

function compactMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return "";
  return sanitizeUserFacingText(JSON.stringify(metadata));
}

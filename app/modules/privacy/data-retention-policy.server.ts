export type RetentionEntityType =
  | "share_link"
  | "notification"
  | "webhook_event"
  | "privacy_export"
  | "temporary_workdir"
  | "journal_entry"
  | "document"
  | "attachment"
  | "closing_evidence"
  | "expert_dossier";

const AUTO_PURGE_DAYS: Partial<Record<RetentionEntityType, number>> = {
  share_link: 30,
  notification: 365,
  webhook_event: 90,
  privacy_export: 7,
  temporary_workdir: 1,
};

const ACCOUNTING_EVIDENCE: RetentionEntityType[] = [
  "journal_entry",
  "document",
  "attachment",
  "closing_evidence",
  "expert_dossier",
];

export class DataRetentionPolicy {
  describe(entityType: RetentionEntityType) {
    const autoPurgeAfterDays = AUTO_PURGE_DAYS[entityType] ?? null;
    const protectedAccountingEvidence = ACCOUNTING_EVIDENCE.includes(entityType);
    return {
      entityType,
      autoPurgeAllowed: Boolean(autoPurgeAfterDays) && !protectedAccountingEvidence,
      autoPurgeAfterDays,
      protectedAccountingEvidence,
      reason: protectedAccountingEvidence
        ? "Preuve comptable conservée : aucune purge automatique."
        : autoPurgeAfterDays
          ? `Donnée non comptable purgeable après ${autoPurgeAfterDays} jour(s).`
          : "Aucune règle de purge automatique définie.",
    };
  }

  listPolicies() {
    return [
      ...Object.keys(AUTO_PURGE_DAYS),
      ...ACCOUNTING_EVIDENCE,
    ].map((entityType) => this.describe(entityType as RetentionEntityType));
  }
}

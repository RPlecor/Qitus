import { DataRetentionReferenceCenter } from "../official-references/data-retention-reference-center.server";

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

const ACCOUNTING_EVIDENCE: RetentionEntityType[] = [
  "journal_entry",
  "document",
  "attachment",
  "closing_evidence",
  "expert_dossier",
];

export class DataRetentionPolicy {
  constructor(private readonly reference = new DataRetentionReferenceCenter()) {}

  async describe(entityType: RetentionEntityType) {
    const autoPurgeAfterDays = await this.reference.getRetentionDays(entityType);
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

  async listPolicies() {
    return await Promise.all([
      ...(await this.reference.listPurgeableRules()).map((rule) => rule.kind),
      ...ACCOUNTING_EVIDENCE,
    ].map((entityType) => this.describe(entityType as RetentionEntityType)));
  }
}

import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { DossierSnapshotReviewCenter } from "./dossier-snapshot-review-center.server";

export type ExpertDossierExportIssue = {
  code: string;
  severity: "blocking" | "warning";
  label: string;
};

export type ExpertDossierExportVerification = {
  generatedAt: string;
  status: "verified" | "blocked" | "warning";
  blockingCount: number;
  warningCount: number;
  issues: ExpertDossierExportIssue[];
};

const requiredRootKeys = [
  "fec",
  "taxPackage",
  "evidenceBundle",
  "expertReview",
  "activity",
  "sections",
  "readiness",
];

export class ExpertDossierExportVerifier {
  constructor(private readonly snapshots = new DossierSnapshotReviewCenter()) {}

  async verifyManifest(_workspace: CompanyWorkspace, manifest: unknown): Promise<ExpertDossierExportVerification> {
    const data = asRecord(manifest);
    const issues: ExpertDossierExportIssue[] = [];
    for (const key of requiredRootKeys) {
      if (!(key in data)) issues.push(issue("MISSING_MANIFEST_SECTION", "blocking", `Section export manquante : ${key}`));
    }
    const fec = asRecord(data.fec);
    if (!fec.fec) issues.push(issue("FEC_MISSING", "blocking", "FEC absent du dossier exporté."));
    if (fec.status && fec.status !== "ready") issues.push(issue("FEC_NOT_READY", "blocking", "FEC non prêt selon le précontrôle."));
    const taxPackage = asRecord(data.taxPackage);
    if (!taxPackage.sourceDocumentId && !taxPackage.sourceFilename) issues.push(issue("TAX_PACKAGE_SOURCE_MISSING", "blocking", "Liasse fiscale CERFA absente."));
    const completeness = asRecord(taxPackage.completeness);
    if (Number(completeness.blocked ?? 0) > 0) issues.push(issue("TAX_PACKAGE_CERFA_BLOCKED", "blocking", "Liasse fiscale CERFA bloquée."));
    const evidenceBundle = asRecord(data.evidenceBundle);
    if (evidenceBundle.error) issues.push(issue("EVIDENCE_BUNDLE_UNAVAILABLE", "warning", String(evidenceBundle.error)));
    const evidenceTaxPackage = asRecord(evidenceBundle.taxPackage);
    if (evidenceTaxPackage && !evidenceBundle.error && !evidenceTaxPackage.draft) issues.push(issue("TAX_PACKAGE_CERFA_MANIFEST_MISSING", "blocking", "Manifeste CERFA case par case absent du dossier de preuves."));
    const reviewRuns = Array.isArray(data.expertReview) ? data.expertReview : [];
    const signedOff = reviewRuns.some((run) => asRecord(run).status === "SIGNED_OFF");
    if (!signedOff) issues.push(issue("EXPERT_SIGNOFF_MISSING", "blocking", "Validation finale expert-comptable absente."));
    const openBlocking = reviewRuns.some((run) => {
      const items: unknown[] = Array.isArray(asRecord(run).items) ? asRecord(run).items as unknown[] : [];
      return items.some((item) => {
        const row = asRecord(item);
        return row.severity === "BLOCKING" && (row.status === "OPEN" || row.status === "ANSWERED");
      });
    });
    if (openBlocking) issues.push(issue("OPEN_BLOCKING_REVIEW_ITEM", "blocking", "Demande EC bloquante encore ouverte."));
    return summarizeIssues(issues);
  }

  async listExportMissingArtifacts(workspace: CompanyWorkspace) {
    const latest = (await this.snapshots.summarizeSnapshotState(workspace)).latest;
    const manifest = latest?.manifest;
    const verification = await this.verifyManifest(workspace, manifest ?? {});
    return verification.issues;
  }

  async assertExportMatchesSnapshot(workspace: CompanyWorkspace, snapshotId: string) {
    const diff = await this.snapshots.getSnapshotDiff(workspace, snapshotId);
    if (diff.freshness.isStale) {
      return {
        matches: false,
        snapshot: diff.snapshot,
        issues: diff.freshness.reasons.map((reason) => issue("SNAPSHOT_STALE", "blocking", reason.label)),
      };
    }
    return { matches: true, snapshot: diff.snapshot, issues: [] };
  }

  async getExportVerificationReport(workspace: CompanyWorkspace) {
    const latest = (await this.snapshots.summarizeSnapshotState(workspace)).latest;
    const verification = await this.verifyManifest(workspace, latest?.manifest ?? {});
    return {
      snapshot: latest,
      verification,
      missingArtifacts: verification.issues,
    };
  }
}

function summarizeIssues(issues: ExpertDossierExportIssue[]): ExpertDossierExportVerification {
  const blockingCount = issues.filter((item) => item.severity === "blocking").length;
  const warningCount = issues.filter((item) => item.severity === "warning").length;
  return {
    generatedAt: new Date().toISOString(),
    status: blockingCount > 0 ? "blocked" : warningCount > 0 ? "warning" : "verified",
    blockingCount,
    warningCount,
    issues,
  };
}

function issue(code: string, severity: ExpertDossierExportIssue["severity"], label: string): ExpertDossierExportIssue {
  return { code, severity, label };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

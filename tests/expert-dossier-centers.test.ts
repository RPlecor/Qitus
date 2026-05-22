import { DocumentType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { ExpertDossierCenter } from "../app/modules/expert-dossier/expert-dossier-center.server";
import { FecPrecheckCenter } from "../app/modules/expert-dossier/fec-precheck-center.server";
import { TaxPackageCompletionCenter } from "../app/modules/expert-dossier/tax-package-completion-center.server";

describe("Phase 15 expert dossier centers", () => {
  it("prechecks a fresh FEC against the journal", async () => {
    const center = new FecPrecheckCenter(
      { async listDocuments() { return [document("fec_1", DocumentType.FEC, { entriesCount: 40 })]; } } as never,
      { async getAuditSummary() { return journalAudit({ entriesCount: 40 }); } } as never
    );

    const precheck = await center.getFecPrecheck(workspace());

    expect(precheck.status).toBe("ready");
    expect(precheck.blockingCount).toBe(0);
    expect(precheck.fec?.filename).toBe("fec.txt");
  });

  it("blocks FEC export when the generated file disagrees with journal count", async () => {
    const center = new FecPrecheckCenter(
      { async listDocuments() { return [document("fec_1", DocumentType.FEC, { entriesCount: 39 })]; } } as never,
      { async getAuditSummary() { return journalAudit({ entriesCount: 40 }); } } as never
    );

    const precheck = await center.getFecPrecheck(workspace());

    expect(precheck.status).toBe("blocked");
    expect(precheck.issues.map((issue) => issue.code)).toContain("ENTRY_COUNT_MISMATCH");
  });

  it("requires a fresh structured tax package but treats PDF as optional", async () => {
    const center = new TaxPackageCompletionCenter(
      { async getTaxPackageSummary() { return { documentId: "liasse_1", filename: "liasse.md", pdfDocumentId: null, pdfFilename: null, status: "ready", generatedAt: "2025-12-31T10:00:00.000Z" }; } } as never,
      { async getFreshness() { return { documents: [{ documentId: "liasse_1", isStale: false }] }; } } as never
    );

    const completion = await center.getTaxPackageCompletion(workspace());

    expect(completion.status).toBe("warning");
    expect(completion.warnings).toContain("PDF de liasse absent : rendu optionnel non généré.");
  });

  it("aggregates dossier sections into blocked readiness when high-risk gaps remain", async () => {
    const center = new ExpertDossierCenter(
      { async getCoverageOverview() { return { status: "blocked", score: 60, label: "Couverture EC à risque", highRisk: 1, areas: [{ title: "Justificatifs", risk: "high", status: "missing" }] }; } } as never,
      { async listDocuments() { return [document("fec_1", DocumentType.FEC), document("balance_1", DocumentType.BALANCE)]; } } as never,
      { async getFecPrecheck() { return { status: "ready", label: "FEC précontrôlé", fec: document("fec_1", DocumentType.FEC), issues: [], blockingCount: 0, warningCount: 0, journal: journalAudit() }; } } as never,
      { async getTaxPackageCompletion() { return { status: "blocked", label: "Liasse incomplète", sourceDocumentId: null, sourceFilename: null, pdfDocumentId: null, pdfFilename: null, generatedAt: null, missingSections: ["Source structurée de liasse fiscale"], warnings: [] }; } } as never,
      { async getAuditSummary() { return journalAudit(); } } as never,
      { async summarizeEvidenceGaps() { return { total: 2, satisfied: 1, missing: 1, requiredMissing: 1 }; } } as never,
      { async getVatReview() { return { status: "not_applicable", blockingCount: 0, warningCount: 0, controls: [] }; } } as never,
      { async summarizeReconciliationReadiness() { return { status: "ready", issues: { open: 0, blocking: 0, warning: 0 }, bank: { progress: 100 } }; } } as never,
      { async getClosingOverview() { return { run: { status: "IN_PROGRESS" }, blockers: [{ label: "Étape non terminée" }], warnings: [], steps: [] }; } } as never,
      { async getReviewStats() { return { runs: 0, openItems: 0, openBlockingItems: 0, signedOff: 0 }; } } as never
    );

    const overview = await center.getDossierOverview(workspace());

    expect(overview.readiness.status).toBe("blocked");
    expect(overview.sections.find((section) => section.code === "tax_package")).toMatchObject({ status: "blocked", risk: "high" });
  });
});

function workspace() {
  return {
    user: { id: "user_1", email: "demo@paperasse.local" },
    company: { id: "company_1", name: "ACME", siren: "912345678", vatRegime: "FRANCHISE" },
    fiscalYear: { id: "fy_1", startDate: new Date("2025-01-01"), endDate: new Date("2025-12-31"), status: "OPEN" },
  } as never;
}

function journalAudit(overrides: { entriesCount?: number } = {}) {
  return {
    status: "exportable",
    label: "Journal équilibré",
    blockingCount: 0,
    warningCount: 0,
    issues: [],
    summary: {
      entriesCount: overrides.entriesCount ?? 40,
      linesCount: 80,
      debitTotal: 100,
      creditTotal: 100,
      balanced: true,
    },
  };
}

function document(id: string, type: DocumentType, overrides: Partial<{ entriesCount: number; freshness: unknown }> = {}) {
  return {
    id,
    type,
    filename: type === DocumentType.FEC ? "fec.txt" : `${String(type).toLowerCase()}.md`,
    format: type === DocumentType.FEC ? "txt" : "md",
    sizeBytes: 100,
    entriesCount: overrides.entriesCount ?? 40,
    generatedBy: "test",
    scriptVersion: "test",
    generatedAt: "2025-12-31T12:00:00.000Z",
    status: "READY",
    errorMessage: null,
    freshness: overrides.freshness ?? { isStale: false, statusLabel: "À jour" },
  };
}

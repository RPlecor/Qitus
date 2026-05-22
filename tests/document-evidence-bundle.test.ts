import { describe, expect, it } from "vitest";
import { DocumentEvidenceBundle } from "../app/modules/documents/document-evidence-bundle.server";

describe("DocumentEvidenceBundle", () => {
  it("builds a stable evidence manifest when a FEC exists", async () => {
    const bundle = new DocumentEvidenceBundle(
      { async listDocuments() { return [document("doc_1", "FEC")]; } } as never,
      { async getAuditSummary() { return { status: "exportable", summary: { entriesCount: 40, linesCount: 80, debitTotal: 100, creditTotal: 100, balanced: true } }; } } as never,
      { async exportCsv() { return "\"num\",\"date\""; } } as never,
      { async summarizeVatForFiscalYear() { return { deductible: 0, collected: 0, net: 0 }; } } as never,
      { async getCoverageOverview() { return coverage(); } } as never,
      {} as never,
      { async summarizeEvidenceGaps() { return evidenceSummary(); }, async listEvidenceRequirements() { return [{ label: "Pièce OVH", missing: false, level: "required" }]; } } as never,
      { async exists() { return true; }, async get() { return { body: Buffer.from("facture"), sizeBytes: 7 }; } } as never,
      { async listAttachments() { return [attachment()]; } } as never
    );
    const manifest = await bundle.getBundleManifest(workspace());
    expect(manifest).toMatchObject({
      company: { name: "ACME" },
      journal: { auditStatus: "exportable", csv: "\"num\",\"date\"" },
      coverage: { score: 50, label: "Couverture EC partielle" },
      attachments: { files: [{ filename: "ovh-facture.txt", available: true, contentBase64: Buffer.from("facture").toString("base64") }] },
      documents: [{ filename: "fec.txt", scriptVersion: "abc123" }],
    });
  });

  it("refuses bundle download before FEC generation", async () => {
    const bundle = new DocumentEvidenceBundle(
      { async listDocuments() { return [document("doc_2", "BALANCE")]; } } as never,
      { async getAuditSummary() { return { status: "exportable", summary: { entriesCount: 0, linesCount: 0, debitTotal: 0, creditTotal: 0, balanced: true } }; } } as never,
      { async exportCsv() { return ""; } } as never,
      { async summarizeVatForFiscalYear() { return { deductible: 0, collected: 0, net: 0 }; } } as never,
      { async getCoverageOverview() { return coverage(); } } as never,
      {} as never,
      { async summarizeEvidenceGaps() { return evidenceSummary(); }, async listEvidenceRequirements() { return []; } } as never,
      { async exists() { return true; }, async get() { return { body: Buffer.from(""), sizeBytes: 0 }; } } as never,
      { async listAttachments() { return []; } } as never
    );
    await expect(bundle.getBundleManifest(workspace())).rejects.toThrow("Aucun FEC généré");
  });
});

function workspace() {
  return {
    company: { id: "company_1", name: "ACME", siren: "912345678" },
    fiscalYear: { id: "fy_1", startDate: new Date("2025-01-01"), endDate: new Date("2025-12-31") },
  } as never;
}

function evidenceSummary() {
  return {
    total: 1,
    missing: 0,
    requiredMissing: 0,
    recommendedMissing: 0,
    satisfied: 1,
    requiredTotal: 1,
    recommendedTotal: 0,
    byKind: { invoice: 0, receipt: 0, bank_statement: 0, contract: 0, user_decision: 0, expert_validation: 0 },
  };
}

function attachment() {
  return {
    id: "att_1",
    originalFilename: "ovh-facture.txt",
    mimeType: "text/plain",
    sizeBytes: 42,
    sha256: "abc",
    status: "EXTRACTED",
    storageKey: "company/fy/ovh-facture.txt",
    links: [{ entityType: "TRANSACTION", entityId: "txn_1", relationType: "INVOICE" }],
  };
}

function coverage() {
  return {
    score: 50,
    label: "Couverture EC partielle",
    status: "partial",
    covered: 3,
    partial: 5,
    missing: 3,
    highRisk: 2,
    areas: [{ code: "evidence", status: "missing", risk: "high", nextPhase: "Phase 11" }],
  };
}

function document(id: string, type: string) {
  return {
    id,
    type,
    filename: type === "FEC" ? "fec.txt" : "balance.md",
    format: type === "FEC" ? "txt" : "md",
    sizeBytes: 123,
    entriesCount: 40,
    generatedBy: "script",
    scriptVersion: "abc123",
    generatedAt: "2026-05-19T10:00:00.000Z",
    status: "READY",
    errorMessage: null,
    freshness: { statusLabel: "À jour" },
  };
}

import { describe, expect, it } from "vitest";
import { ExpertDossierExportVerifier } from "../app/modules/expert-dossier/expert-dossier-export-verifier.server";
import { ExpertDossierReadinessWorkflow } from "../app/modules/expert-dossier/expert-dossier-readiness-workflow.server";
import { ExpertReviewPortalProjection } from "../app/modules/expert-dossier/expert-review-portal-projection.server";

describe("Phase 15.5 expert dossier freeze", () => {
  it("classifies blocked dossier sections before review", async () => {
    const workflow = new ExpertDossierReadinessWorkflow(
      { async getDossierOverview() { return overview([{ code: "fec", title: "FEC", status: "blocked", risk: "high", summary: "FEC absent", evidence: [], gaps: ["FEC absent"], href: "/documents" }]); } } as never,
      { async summarizeSnapshotState() { return { latest: null, label: "Aucun snapshot", snapshots: [], total: 0, stale: 0, fresh: 0 }; } } as never,
      { async summarizeReviewReadiness() { return { signedOff: false, openBlockingItems: 0 }; } } as never,
      { async prepareSnapshot() { return { id: "snap_1" }; } } as never,
      { async recordActivity() {} } as never
    );

    const queue = await workflow.getReadinessQueue(workspace());

    expect(queue.blockingItems.map((item) => item.code)).toContain("section_fec_blocked");
    expect(queue.recommendedActions[0]).toMatchObject({ href: "/documents", severity: "blocking" });
  });

  it("does not block review preparation only because expert signoff is missing", async () => {
    const workflow = new ExpertDossierReadinessWorkflow(
      { async getDossierOverview() { return overview([{ code: "expert_review", title: "Revue EC", status: "blocked", risk: "high", summary: "Signoff absent", evidence: [], gaps: ["Validation finale EC absente"], href: "/dossier-ec/revue" }]); } } as never,
      { async summarizeSnapshotState() { return { latest: null, label: "Aucun snapshot", snapshots: [], total: 0, stale: 0, fresh: 0 }; } } as never,
      { async summarizeReviewReadiness() { return { signedOff: false, openBlockingItems: 0 }; } } as never,
      { async prepareSnapshot() { return { id: "snap_1", status: "SUBMITTED" }; } } as never,
      { async recordActivity() {} } as never
    );

    await expect(workflow.prepareForReview(workspace())).resolves.toMatchObject({ snapshot: { id: "snap_1" } });
  });

  it("verifies manifest completeness and blocking review items", async () => {
    const verifier = new ExpertDossierExportVerifier({} as never);

    const verification = await verifier.verifyManifest(workspace(), {
      fec: { status: "ready", fec: { filename: "fec.txt" } },
      taxPackage: { sourceDocumentId: "doc_1" },
      evidenceBundle: {},
      expertReview: [{ status: "IN_REVIEW", items: [{ severity: "BLOCKING", status: "OPEN" }] }],
      activity: [],
      sections: [],
      readiness: {},
    });

    expect(verification.status).toBe("blocked");
    expect(verification.issues.map((issue) => issue.code)).toContain("OPEN_BLOCKING_REVIEW_ITEM");
  });

  it("accepts a signed off manifest with required artifacts", async () => {
    const verifier = new ExpertDossierExportVerifier({} as never);

    const verification = await verifier.verifyManifest(workspace(), {
      fec: { status: "ready", fec: { filename: "fec.txt" } },
      taxPackage: { sourceFilename: "liasse.md" },
      evidenceBundle: {},
      expertReview: [{ status: "SIGNED_OFF", items: [] }],
      activity: [],
      sections: [],
      readiness: {},
    });

    expect(verification.status).toBe("verified");
    expect(verification.blockingCount).toBe(0);
  });

  it("rejects accounting mutations through the shared portal projection", () => {
    const portal = new ExpertReviewPortalProjection({} as never, {} as never, {} as never, {} as never, {} as never, {} as never);

    expect(() => portal.assertReadOnlyPermission("token", "approve_closing_adjustment")).toThrow(/lecture seule/);
    expect(() => portal.assertReadOnlyPermission("token", "add_comment")).not.toThrow();
  });
});

function workspace() {
  return {
    user: { id: "user_1", email: "demo@paperasse.local" },
    company: { id: "company_1", name: "ACME" },
    fiscalYear: { id: "fy_1", startDate: new Date("2025-01-01"), endDate: new Date("2025-12-31"), status: "OPEN" },
  } as never;
}

function overview(sections: Array<Record<string, unknown>>) {
  return {
    generatedAt: "2026-05-21T10:00:00.000Z",
    company: { id: "company_1", name: "ACME" },
    fiscalYear: { id: "fy_1", startDate: "2025-01-01", endDate: "2025-12-31", status: "OPEN" },
    readiness: { status: "blocked", label: "Dossier bloqué", score: 40, ready: 0, partial: 0, blocked: 1, stale: 0, highRisk: 1 },
    sections,
  };
}

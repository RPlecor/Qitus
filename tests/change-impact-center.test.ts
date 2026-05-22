import { describe, expect, it } from "vitest";
import {
  ChangeImpactCenter,
  AccountingRulesImpactSource,
  DocumentImpactSource,
  VatImpactSource,
  buildChangeImpactOverviewForTest,
  impact,
  type ChangeImpactSource,
} from "../app/modules/change-impacts/change-impact-center.server";

const workspace = {
  company: { id: "company_1", vatRegime: "REEL_NORMAL" },
  fiscalYear: { id: "fy_1", status: "OPEN", startDate: new Date("2025-01-01") },
} as never;

describe("ChangeImpactCenter", () => {
  it("aggregates, sorts and summarizes impacts", async () => {
    const center = new ChangeImpactCenter([
      source("documents", ["dashboard"], [
        impact({
          code: "documents.stale",
          source: "documents",
          status: "action_required",
          severity: "warning",
          title: "Documents à régénérer",
          message: "Un document est obsolète.",
          why: ["Écriture modifiée."],
          surfaces: ["dashboard"],
          blockingCapabilities: [],
          affectedArtifacts: ["FEC"],
          primaryAction: { label: "Documents", href: "/documents" },
        }),
      ]),
      source("vat", ["dashboard"], [
        impact({
          code: "vat.ledger_readiness",
          source: "vat",
          status: "blocked",
          severity: "blocking",
          title: "TVA à recalculer",
          message: "Les écritures ne contiennent pas de lignes TVA.",
          why: ["Régime réel actif."],
          surfaces: ["dashboard"],
          blockingCapabilities: ["generate_vat_declaration"],
          affectedArtifacts: ["CA3"],
          primaryAction: { label: "TVA", href: "/tva" },
        }),
      ]),
    ], "shadow");

    const overview = await center.getImpactOverview(workspace, { surface: "dashboard" });

    expect(overview).toMatchObject({
      mode: "shadow",
      status: "blocked",
      total: 2,
      blocking: 1,
      actionRequired: 2,
    });
    expect(overview.impacts[0].code).toBe("vat.ledger_readiness");
  });

  it("does not call heavy sources on dashboard", async () => {
    const calls: string[] = [];
    const center = new ChangeImpactCenter([
      countingSource("documents", ["dashboard"], calls),
      countingSource("evidence", ["documents", "dossier_ec"], calls),
      countingSource("expert-dossier", ["dossier_ec"], calls),
    ], "shadow");

    await center.getImpactOverview(workspace, { surface: "dashboard" });

    expect(calls).toEqual(["documents"]);
  });

  it("blocks only capabilities explicitly attached to blocking impacts", async () => {
    const center = new ChangeImpactCenter([
      source("vat", ["tva"], [
        impact({
          code: "vat.blocked",
          source: "vat",
          status: "blocked",
          severity: "blocking",
          title: "TVA bloquée",
          message: "Corrigez la TVA.",
          why: ["Taux manquant."],
          surfaces: ["tva"],
          blockingCapabilities: ["generate_vat_declaration"],
          affectedArtifacts: ["CA3"],
          primaryAction: { label: "TVA", href: "/tva" },
        }),
      ]),
    ], "shadow");

    await expect(center.assertNoBlockingImpact(workspace, "generate_documents")).resolves.toEqual({ capability: "generate_documents", ok: true });
    await expect(center.assertNoBlockingImpact(workspace, "generate_vat_declaration")).rejects.toThrow("Corrigez la TVA");
  });

  it("returns no sources when mode is off", async () => {
    const calls: string[] = [];
    const center = new ChangeImpactCenter([countingSource("documents", ["dashboard"], calls)], "off");
    const overview = await center.getImpactOverview(workspace, { surface: "dashboard" });

    expect(overview.total).toBe(0);
    expect(calls).toEqual([]);
  });

  it("builds a test overview with stable counters", () => {
    const overview = buildChangeImpactOverviewForTest("active", [
      impact({
        code: "closing.stale",
        source: "closing",
        status: "action_required",
        severity: "warning",
        title: "OD à recalculer",
        message: "Une OD est obsolète.",
        why: [],
        surfaces: ["cloture"],
        blockingCapabilities: ["approve_closing_adjustment"],
        affectedArtifacts: [],
        primaryAction: { label: "Clôture", href: "/cloture/od" },
      }),
    ], 1);

    expect(overview).toMatchObject({ mode: "active", status: "action_required", warning: 1 });
  });
});

describe("Change impact sources", () => {
  it("DocumentImpactSource surfaces profile-driven stale documents", async () => {
    const source = new DocumentImpactSource({
      async getFreshness() {
        return {
          staleCount: 1,
          newestBusinessEventAt: "2026-05-22T08:00:00.000Z",
          reasons: [{ code: "profile_updated", label: "Profil entreprise modifié", at: "2026-05-22T08:00:00.000Z" }],
          documents: [{
            documentId: "doc_1",
            type: "FEC",
            filename: "fec.txt",
            generatedAt: "2026-05-22T07:00:00.000Z",
            isStale: true,
            statusLabel: "À régénérer",
            reasons: [{ code: "profile_updated", label: "Profil entreprise modifié", at: "2026-05-22T08:00:00.000Z" }],
          }],
        };
      },
    } as never);

    const impacts = await source.listImpacts(workspace);

    expect(impacts[0]).toMatchObject({
      code: "documents.stale",
      status: "action_required",
      affectedArtifacts: ["fec.txt"],
    });
    expect(impacts[0].why).toContain("Profil entreprise modifié");
  });

  it("VatImpactSource surfaces real-regime ledgers without VAT lines", async () => {
    const source = new VatImpactSource({
      async getReadiness() {
        return {
          status: "action_required",
          title: "Les écritures existantes doivent être recalculées pour produire la TVA",
          message: "Le régime réel est actif, mais les écritures d'import ne contiennent pas de lignes TVA.",
          counters: { importEntriesWithoutVatLines: 40 },
          actions: [{ label: "Relancer la catégorisation", href: "/imports", primary: true }],
        };
      },
    } as never, {
      async getVatReview() {
        return { status: "ready", blockingCount: 0, warningCount: 0, controls: [] };
      },
    } as never);

    const impacts = await source.listImpacts(workspace);

    expect(impacts[0]).toMatchObject({
      code: "vat.ledger_readiness",
      severity: "blocking",
      blockingCapabilities: ["generate_vat_declaration"],
    });
  });

  it("AccountingRulesImpactSource stays quiet until a pack is applied to the workspace", async () => {
    const source = new AccountingRulesImpactSource({
      async getRuleUpdateStatus() {
        return {
          activePack: { id: "pack_1" },
          application: null,
          impact: { existingDataRequiresExplicitAction: true, affectedTransactionCount: 3, conflictCount: 0 },
        };
      },
    } as never);

    await expect(source.listImpacts(workspace)).resolves.toEqual([]);
  });
});

function source(sourceKey: string, surfaces: Array<"dashboard" | "documents" | "tva" | "cloture" | "couverture" | "dossier_ec" | "connecteurs">, impacts: Awaited<ReturnType<ChangeImpactSource["listImpacts"]>>): ChangeImpactSource {
  return {
    sourceKey,
    surfaces,
    async listImpacts() {
      return impacts;
    },
  };
}

function countingSource(sourceKey: string, surfaces: ChangeImpactSource["surfaces"], calls: string[]): ChangeImpactSource {
  return {
    sourceKey,
    surfaces,
    async listImpacts() {
      calls.push(sourceKey);
      return [];
    },
  };
}

import { describe, expect, it, vi } from "vitest";
import { AccountingRulePackCenter, checksumJson, vendorMappingRuleId } from "../app/modules/accounting-rules/accounting-rule-pack-center.server";
import { RegulatorySourceCenter } from "../app/modules/accounting-rules/regulatory-source-center.server";
import { checksumContent, type RegulatorySourceAdapter } from "../app/modules/accounting-rules/regulatory-source-adapter.server";
import { RuleImpactPreviewCenter } from "../app/modules/accounting-rules/rule-impact-preview-center.server";
import { RuleApplicationWorkflow } from "../app/modules/accounting-rules/rule-application-workflow.server";

const workspace = {
  user: { id: "user_1" },
  company: { id: "company_1" },
  fiscalYear: { id: "fy_1", status: "OPEN" },
} as never;

describe("official accounting rules auto-update", () => {
  it("detects a new official source snapshot through checksum", async () => {
    const adapter: RegulatorySourceAdapter = {
      source: "anc_pcg",
      async fetchSnapshot() {
        return {
          source: "anc_pcg",
          sourceUrl: "https://www.anc.gouv.fr/plan-comptable-general",
          title: "ANC PCG",
          content: "plan comptable general v1",
          publishedAt: new Date("2026-05-22T00:00:00.000Z"),
          metadata: { official: true },
        };
      },
    };
    const db = {
      regulatorySourceSnapshot: {
        findUnique: vi.fn(async () => null),
        create: vi.fn(async (args) => ({ id: "snapshot_1", ...args.data })),
      },
    };
    const center = new RegulatorySourceCenter([adapter], db as never);

    const [result] = await center.syncOfficialSources();

    expect(result).toMatchObject({ source: "anc_pcg", changed: true, snapshotId: "snapshot_1" });
    expect(db.regulatorySourceSnapshot.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        checksum: checksumContent("plan comptable general v1"),
        changes: expect.objectContaining({
          create: expect.objectContaining({ severity: "INFO", status: "NEW" }),
        }),
      }),
    }));
  });

  it("keeps text-only BOFiP changes in internal review packs", async () => {
    const change = {
      id: "change_1",
      changeKey: "bofip:abc",
      sourceSnapshot: { source: "bofip_rss" },
    };
    const db = fakeRulePackDb({ changes: [change] });
    const center = new AccountingRulePackCenter(db as never);

    const pack = await center.buildRulePackFromRegulatoryChanges();

    expect(pack.status).toBe("NEEDS_REVIEW");
    expect(db.accountingRulePack.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        status: "NEEDS_REVIEW",
        summary: expect.stringContaining("revue interne"),
      }),
    }));
    expect(db.vendorMapping.upsert).not.toHaveBeenCalled();
  });

  it("activates structured rule packs and versions vendor mappings for future imports", async () => {
    const db = fakeRulePackDb({ changes: [] });
    const center = new AccountingRulePackCenter(db as never);

    const pack = await center.syncSeedRulePack();

    expect(pack.status).toBe("ACTIVE");
    expect(db.accountingRulePack.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { status: "ARCHIVED" },
    }));
    expect(db.vendorMapping.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ active: false, supersededAt: expect.any(Date) }),
    }));
    expect(db.vendorMapping.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        rulePackId: "pack_1",
        source: "qitus-official",
        active: true,
      }),
    }));
  });

  it("previews existing transactions affected by a new pack without changing protected categorizations", async () => {
    const db = {
      vendorMapping: {
        findMany: vi.fn(async () => [{
          id: "mapping_1",
          pattern: "ovh",
          matchType: "LABEL_KEYWORD",
          accountDebit: "626000",
          accountLabel: "Télécoms",
        }]),
      },
      transaction: {
        findMany: vi.fn(async () => [{
          id: "tx_1",
          date: new Date("2025-03-01"),
          label: "OVH CLOUD",
          normalizedLabel: "ovh cloud",
          counterparty: "OVH",
          amount: 42,
          categorization: { accountDebit: "471000", status: "USER_CORRECTED" },
        }]),
      },
      correctionRule: {
        findMany: vi.fn(async () => [{ id: "rule_1", counterparty: "OVH", preferredAccount: "471000" }]),
      },
    };
    const center = new RuleImpactPreviewCenter(db as never);

    const impact = await center.previewRulePackImpact(workspace, "pack_1");

    expect(impact).toMatchObject({
      affectedTransactionCount: 1,
      protectedTransactionCount: 1,
      conflictCount: 1,
      safeForAutomaticFutureImports: true,
      existingDataRequiresExplicitAction: true,
    });
    expect(impact.affectedTransactions[0]).toMatchObject({ currentAccount: "471000", suggestedAccount: "626000", protected: true });
  });

  it("records active pack application without mutating existing entries", async () => {
    const packs = {
      getActiveRulePack: vi.fn(async () => ({ id: "pack_1", version: "official-1" })),
      syncSeedRulePack: vi.fn(),
    };
    const preview = {
      previewRulePackImpact: vi.fn(async () => ({
        rulePackId: "pack_1",
        affectedTransactionCount: 2,
        conflictCount: 1,
      })),
    };
    const activity = { recordActivity: vi.fn(async () => ({})) };
    const db = {
      accountingRuleApplication: {
        findUnique: vi.fn(async () => null),
        upsert: vi.fn(async (args) => ({ id: "application_1", ...args.create })),
      },
    };
    const workflow = new RuleApplicationWorkflow(packs as never, preview as never, activity as never, db as never);

    const result = await workflow.applyActiveRulePackToWorkspace(workspace);

    expect(result.application).toMatchObject({
      status: "AUTO_APPLIED",
      note: expect.stringContaining("futurs imports"),
    });
    expect(db.accountingRuleApplication.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ companyId: "company_1", fiscalYearId: "fy_1", rulePackId: "pack_1" }),
    }));
    expect(activity.recordActivity).toHaveBeenCalledWith(workspace, expect.objectContaining({
      action: "accounting_rule_update.applied",
      metadata: { affectedTransactionCount: 2, conflictCount: 1 },
    }));
  });

  it("keeps stable ids and checksums for deterministic rule versions", () => {
    expect(vendorMappingRuleId("qitus-seed-abc", "OVH Cloud")).toBe("rule-qitus-seed-abc-ovh-cloud");
    expect(checksumJson({ a: 1 })).toHaveLength(64);
  });
});

function fakeRulePackDb({ changes }: { changes: Array<Record<string, unknown>> }) {
  const pack = {
    id: "pack_1",
    version: `qitus-seed-${checksumJson({ mappings: "test" }).slice(0, 12)}`,
    status: changes.some((change) => (change.sourceSnapshot as { source?: string })?.source === "anc_pcg") || changes.length === 0 ? "ACTIVE" : "NEEDS_REVIEW",
    source: "qitus-official",
    checksum: "checksum",
    effectiveFrom: new Date("2025-01-01T00:00:00.000Z"),
    activatedAt: new Date("2026-05-22T00:00:00.000Z"),
    summary: "Règles test",
    metadataJson: {},
  };
  const db = {
    regulatoryChange: {
      findMany: vi.fn(async () => changes),
      updateMany: vi.fn(async () => ({ count: changes.length })),
    },
    accountingRulePack: {
      upsert: vi.fn(async (args) => ({ ...pack, ...args.create, ...args.update, id: pack.id })),
      findUniqueOrThrow: vi.fn(async () => pack),
      updateMany: vi.fn(async () => ({ count: 1 })),
      update: vi.fn(async () => pack),
      findFirst: vi.fn(async () => ({ ...pack, vendorMappings: [] })),
    },
    vendorMapping: {
      updateMany: vi.fn(async () => ({ count: 0 })),
      upsert: vi.fn(async (args) => ({ id: args.where.id, ...args.create })),
    },
    $transaction: vi.fn(async (callback) => callback(db)),
  };
  return db;
}

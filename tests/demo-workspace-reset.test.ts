import { describe, expect, it } from "vitest";
import {
  DEMO_DATASETS,
  formatDemoStateDiff,
  getDemoDatasetDefinition,
  getExpectedDemoState,
  isLocalDemoDatabase,
  type DemoWorkspaceState,
} from "../app/modules/demo/demo-workspace-reset.server";

describe("DemoWorkspaceReset", () => {
  it("documents the reproducible MVP demo state", () => {
    expect(getExpectedDemoState()).toEqual({
      imports: 1,
      transactions: 42,
      categorizations: 42,
      reviewTransactions: 2,
      journalEntries: 40,
      journalLines: 80,
      documents: 0,
      fixedAssets: 0,
      bankReconciliations: 0,
    });
  });

  it("keeps the MVP dataset as the default and exposes hardening datasets", () => {
    expect(getDemoDatasetDefinition(undefined).id).toBe("qonto_mvp");
    expect(DEMO_DATASETS.map((dataset) => dataset.id)).toEqual([
      "qonto_mvp",
      "multi_bank",
      "regime_reel_tva",
      "closing_beta",
    ]);
  });

  it("documents the closing beta fixture ingestion state", () => {
    expect(getExpectedDemoState("closing_beta")).toMatchObject({
      imports: 1,
      transactions: 42,
      fixedAssets: 2,
      bankReconciliations: 1,
    });
  });

  it("only accepts local Paperasse database URLs", () => {
    expect(isLocalDemoDatabase("postgresql://rene@localhost:5432/paperasse")).toBe(true);
    expect(isLocalDemoDatabase("postgresql://rene@127.0.0.1:5432/paperasse_demo")).toBe(true);
    expect(isLocalDemoDatabase("postgresql://rene@db.internal:5432/paperasse")).toBe(false);
    expect(isLocalDemoDatabase("postgresql://rene@localhost:5432/customer_prod")).toBe(false);
  });

  it("formats reset drift for clear CLI errors", () => {
    const actual: DemoWorkspaceState = {
      ...getExpectedDemoState(),
      reviewTransactions: 1,
      journalEntries: 41,
    };

    expect(formatDemoStateDiff(actual, getExpectedDemoState())).toEqual([
      "reviewTransactions attendu=2 obtenu=1",
      "journalEntries attendu=40 obtenu=41",
    ]);
  });
});

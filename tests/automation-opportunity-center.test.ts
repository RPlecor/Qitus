import { describe, expect, it, vi } from "vitest";
import {
  AutomationOpportunityCenter,
  type AutomationOpportunity,
  type AutomationOpportunitySource,
} from "../app/modules/automation/automation-opportunity-center.server";

const workspace = {
  company: { id: "company_1" },
  fiscalYear: { id: "fy_1", status: "OPEN" },
  user: { id: "user_1" },
} as never;

describe("AutomationOpportunityCenter", () => {
  it("aggregates and deduplicates domain opportunities", async () => {
    const center = new AutomationOpportunityCenter({
      mode: "assistive",
      sources: [
        stubSource("imports", [stubOpportunity("same", 1), stubOpportunity("suggestion", 2)]),
        stubSource("transactions", [stubOpportunity("same", 1)]),
      ],
    });

    const opportunities = await center.getOpportunities(workspace);

    expect(opportunities.map((item) => item.opportunityKey)).toEqual(["same", "suggestion"]);
  });

  it("does not execute mutations when automation mode is off", async () => {
    const run = vi.fn();
    const center = new AutomationOpportunityCenter({
      mode: "off",
      sources: [stubSource("imports", [stubOpportunity("safe", 1)], run)],
      activity: { recordActivity: vi.fn() } as never,
      assertMutable: vi.fn(),
    });

    const result = await center.runSafeAutomations(workspace);

    expect(run).not.toHaveBeenCalled();
    expect(result).toMatchObject({ mode: "off", attempted: 0, skipped: 0 });
  });

  it("shows opportunities but skips execution in assistive mode", async () => {
    const run = vi.fn();
    const center = new AutomationOpportunityCenter({
      mode: "assistive",
      sources: [stubSource("imports", [stubOpportunity("safe", 1)], run)],
      activity: { recordActivity: vi.fn() } as never,
      assertMutable: vi.fn(),
    });

    const result = await center.runSafeAutomations(workspace);

    expect(run).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
    expect(result.results[0].message).toContain("Mode assisté");
  });

  it("executes only category 1 opportunities in safe auto mode", async () => {
    const run = vi.fn().mockResolvedValue({ message: "ok" });
    const center = new AutomationOpportunityCenter({
      mode: "safe_auto",
      sources: [stubSource("imports", [stubOpportunity("safe", 1), stubOpportunity("manual", 3)], run)],
      activity: { recordActivity: vi.fn() } as never,
      assertMutable: vi.fn(),
    });

    const result = await center.runSafeAutomations(workspace);

    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith(workspace, "safe");
    expect(result).toMatchObject({ attempted: 1, completed: 1, failed: 0 });
  });

  it("summarizes categories and required validations", async () => {
    const center = new AutomationOpportunityCenter({
      mode: "assistive",
      sources: [stubSource("imports", [
        stubOpportunity("safe", 1),
        stubOpportunity("suggestion", 2, true),
        stubOpportunity("draft", 3, true),
      ])],
    });

    const summary = await center.summarizeAutomationReadiness(workspace);

    expect(summary).toMatchObject({
      total: 3,
      safeRunnable: 1,
      suggestions: 1,
      validationRequired: 2,
    });
  });
});

function stubSource(sourceKey: string, opportunities: AutomationOpportunity[], run = vi.fn()): AutomationOpportunitySource {
  return {
    sourceKey,
    async listOpportunities() {
      return opportunities.map((item) => ({ ...item, sourceKey }));
    },
    async runSafeOpportunity(workspaceArg, opportunityKey) {
      return run(workspaceArg, opportunityKey);
    },
    async explainOpportunity(_workspace, opportunityKey) {
      return opportunities.find((item) => item.opportunityKey === opportunityKey) ?? null;
    },
  };
}

function stubOpportunity(opportunityKey: string, category: 1 | 2 | 3, requiresUserValidation = false): AutomationOpportunity {
  return {
    opportunityKey,
    sourceKey: "test",
    domain: "imports",
    category,
    title: opportunityKey,
    detail: "Détail",
    confidence: 1,
    source: "test",
    expectedEffect: "Effet attendu",
    reversible: true,
    requiresUserValidation,
    href: "/imports",
    auditEventName: "automation.safe_run_completed",
  };
}

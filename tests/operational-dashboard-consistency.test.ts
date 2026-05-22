import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencyMocks = vi.hoisted(() => ({
  overview: vi.fn(),
  transactionState: vi.fn(),
  freshness: vi.fn(),
  closing: vi.fn(),
  ruleHealth: vi.fn(),
}));

vi.mock("../app/modules/dashboard/dashboard-overview.server", () => ({
  DashboardOverview: class {
    getOverview = dependencyMocks.overview;
  },
}));

vi.mock("../app/modules/transactions/transaction-explorer.server", () => ({
  TransactionExplorer: class {
    summarizeTransactionState = dependencyMocks.transactionState;
  },
}));

vi.mock("../app/modules/documents/document-freshness-center.server", () => ({
  DocumentFreshnessCenter: class {
    getFreshness = dependencyMocks.freshness;
  },
}));

vi.mock("../app/modules/closing-adjustments/closing-adjustment-center.server", () => ({
  ClosingAdjustmentCenter: class {
    summarizeClosingAdjustments = dependencyMocks.closing;
  },
}));

vi.mock("../app/modules/correction-rules/correction-rule-impact-center.server", () => ({
  CorrectionRuleImpactCenter: class {
    summarizeRuleHealth = dependencyMocks.ruleHealth;
  },
}));

import { OperationalDashboardConsistency } from "../app/modules/dashboard/operational-dashboard-consistency.server";

describe("OperationalDashboardConsistency", () => {
  beforeEach(() => {
    dependencyMocks.overview.mockReset();
    dependencyMocks.transactionState.mockReset();
    dependencyMocks.freshness.mockReset();
    dependencyMocks.closing.mockReset();
    dependencyMocks.ruleHealth.mockReset();
  });

  it("reports a consistent operational dashboard when module readings match", async () => {
    arrange({ overviewReview: 2, transactionReview: 2, stale: 0, draft: 1, broadRules: 0 });
    const report = await new OperationalDashboardConsistency().getConsistencyReport({} as never);
    expect(report.status).toBe("consistent");
    expect(report.label).toBe("Exploitation cohérente");
  });

  it("detects dashboard/transaction divergence", async () => {
    arrange({ overviewReview: 1, transactionReview: 2, stale: 0, draft: 0, broadRules: 0 });
    const report = await new OperationalDashboardConsistency().getConsistencyReport({} as never);
    expect(report.status).toBe("needs_attention");
    expect(report.checks.find((check) => check.code === "dashboard_review_matches_transactions")).toMatchObject({
      ok: false,
      expected: "2",
      actual: "1",
    });
  });
});

function arrange(input: { overviewReview: number; transactionReview: number; stale: number; draft: number; broadRules: number }) {
  dependencyMocks.overview.mockResolvedValue({
    transactionState: { reviewCount: input.overviewReview },
    documentFreshness: { staleCount: input.stale },
    closingAdjustments: { draft: input.draft },
  });
  dependencyMocks.transactionState.mockResolvedValue({ review: input.transactionReview });
  dependencyMocks.freshness.mockResolvedValue({ staleCount: input.stale });
  dependencyMocks.closing.mockResolvedValue({ draft: input.draft });
  dependencyMocks.ruleHealth.mockResolvedValue({ broad: input.broadRules });
}

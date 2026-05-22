import { describe, expect, it } from "vitest";
import { buildDashboardAlerts, filterDashboardAlertsForActiveImpacts } from "../app/modules/dashboard/dashboard-overview.server";

describe("DashboardOverview", () => {
  it("builds review and missing-document alerts from business state", () => {
    expect(buildDashboardAlerts(2, 1, [])).toEqual([
      { type: "review", tone: "orange", message: "2 transactions à vérifier avant génération complète des écritures." },
      { type: "documents", tone: "blue", message: "Le FEC n'a pas encore été généré pour cet exercice." },
    ]);
  });

  it("surfaces an empty-import state and suppresses the FEC alert once generated", () => {
    expect(buildDashboardAlerts(0, 0, ["FEC"])).toEqual([
      { type: "imports", tone: "blue", message: "Aucun import bancaire n'a encore été lancé." },
    ]);
  });

  it("reuses accounting review warnings for pre-closing alerts", () => {
    expect(buildDashboardAlerts(0, 1, ["FEC"], {
      status: "ready_with_warnings",
      blockingCount: 0,
      warningCount: 3,
      controls: [],
      generatedAt: "2026-05-19T00:00:00.000Z",
    })).toContainEqual({
      type: "accounting",
      tone: "orange",
      message: "3 points de pré-clôture à revoir dans Contrôle.",
    });
  });

  it("surfaces stale documents and draft closing adjustments", () => {
    expect(buildDashboardAlerts(0, 1, ["FEC"], null, { staleDocuments: 2, draftAdjustments: 1 })).toContainEqual({
      type: "documents",
      tone: "orange",
      message: "2 documents à régénérer après les dernières écritures.",
    });
    expect(buildDashboardAlerts(0, 1, ["FEC"], null, { staleDocuments: 2, draftAdjustments: 1 })).toContainEqual({
      type: "closing_adjustments",
      tone: "orange",
      message: "1 OD brouillon à relire dans Contrôle.",
    });
  });

  it("keeps legacy alerts in shadow but can remove migrated duplicates in active mode", () => {
    const alerts = buildDashboardAlerts(0, 1, ["FEC"], null, { staleDocuments: 1, draftAdjustments: 1 });

    expect(filterDashboardAlertsForActiveImpacts(alerts, {
      impacts: [
        { source: "documents" },
        { source: "closing" },
      ],
    } as never)).toEqual([]);
  });
});

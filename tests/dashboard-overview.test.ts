import { describe, expect, it } from "vitest";
import { buildDashboardAlerts, filterDashboardAlertsForActiveImpacts } from "../app/modules/dashboard/dashboard-overview.server";

describe("DashboardOverview", () => {
  it("builds review and missing-document alerts from business state", () => {
    expect(buildDashboardAlerts(2, 1, [])).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "review",
        tone: "warning",
        message: "2 transactions à vérifier avant génération complète des écritures.",
        primaryAction: { label: "Corriger les transactions", href: "/transactions?status=review" },
        isActionRequired: true,
      }),
      expect.objectContaining({
        type: "documents",
        tone: "info",
        message: "Le FEC n'a pas encore été généré pour cet exercice.",
        primaryAction: { label: "Générer le FEC", href: "/documents" },
        isActionRequired: true,
      }),
    ]));
  });

  it("surfaces an empty-import state and suppresses the FEC alert once generated", () => {
    expect(buildDashboardAlerts(0, 0, ["FEC"])).toEqual([
      expect.objectContaining({
        type: "imports",
        tone: "info",
        message: "Importez un relevé bancaire pour démarrer le dossier.",
        primaryAction: { label: "Importer un relevé", href: "/imports" },
      }),
    ]);
  });

  it("reuses accounting review warnings for pre-closing alerts", () => {
    expect(buildDashboardAlerts(0, 1, ["FEC"], {
      status: "ready_with_warnings",
      blockingCount: 0,
      warningCount: 3,
      controls: [],
      generatedAt: "2026-05-19T00:00:00.000Z",
    })).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "accounting",
        tone: "warning",
        message: "3 points de pré-clôture à revoir dans Contrôle.",
        primaryAction: { label: "Ouvrir le contrôle", href: "/controle" },
      }),
    ]));
  });

  it("surfaces stale documents and draft closing adjustments", () => {
    expect(buildDashboardAlerts(0, 1, ["FEC"], null, { staleDocuments: 2, draftAdjustments: 1 })).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "documents",
        tone: "warning",
        message: "2 documents sont à mettre à jour après les dernières écritures.",
        primaryAction: { label: "Ouvrir les documents", href: "/documents" },
      }),
      expect.objectContaining({
        type: "closing_adjustments",
        tone: "warning",
        message: "1 OD brouillon attend une décision.",
        primaryAction: { label: "Relire les OD", href: "/cloture/od" },
      }),
    ]));
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

import { describe, expect, it } from "vitest";
import { assertActionableGuidance } from "../app/modules/actionable-guidance";
import { notificationPrimaryActionLabel } from "../app/modules/notifications/notification-center.server";

describe("ActionableGuidance", () => {
  it("rejects required guidance without a primary action", () => {
    expect(() => assertActionableGuidance({
      title: "Action requise",
      message: "Un traitement doit être réalisé.",
      tone: "warning",
      source: "test",
      isActionRequired: true,
    })).toThrow("requires a primary action");
  });

  it("allows informational guidance without action", () => {
    expect(assertActionableGuidance({
      title: "À jour",
      message: "Aucune action nécessaire.",
      tone: "success",
      source: "test",
      isActionRequired: false,
    }).title).toBe("À jour");
  });
});

describe("notificationPrimaryActionLabel", () => {
  it("uses a specific metadata label when provided", () => {
    expect(notificationPrimaryActionLabel("/controle", { primaryActionLabel: "Ouvrir le contrôle" })).toBe("Ouvrir le contrôle");
  });

  it("falls back to a French action label from the href", () => {
    expect(notificationPrimaryActionLabel("/transactions?status=review", null)).toBe("Corriger les transactions");
    expect(notificationPrimaryActionLabel("/rapprochements", null)).toBe("Relancer le rapprochement");
  });
});


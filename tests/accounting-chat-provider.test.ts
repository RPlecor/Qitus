import { describe, expect, it } from "vitest";
import { FakeChatAdapter, type AccountingChatContext } from "../app/modules/chat/accounting-chat-provider.server";
import { ChatReadOnlyPolicy } from "../app/modules/chat/chat-read-only-policy.server";

describe("AccountingChatProvider", () => {
  it("keeps the fake adapter deterministic and read-only", async () => {
    const reply = await new FakeChatAdapter().reply([{ role: "user", content: "Pourquoi la clôture est bloquée ?" }], context());

    expect(reply).toMatchObject({ provider: "fake", model: "fake-chat" });
    expect(reply.content).toContain("lecture seule");
    expect(reply.content).not.toContain("Contexte utilisé");
    expect(reply.content).not.toContain("Références disponibles");
    expect(reply.content).not.toContain("Dashboard");
  });

  it("answers attachment questions in user-facing language", async () => {
    const reply = await new FakeChatAdapter().reply([{ role: "user", content: "Où rattacher un justificatif ?" }], context());

    expect(reply.content).toContain("rattacher un justificatif");
    expect(reply.content).toContain("Justificatifs");
    expect(reply.content).toContain("Transactions");
    expect(reply.content).not.toContain("Contexte utilisé");
    expect(reply.content).not.toContain("Références disponibles");
  });

  it("blocks mutation-like messages before provider execution", () => {
    const policy = new ChatReadOnlyPolicy();
    const decision = policy.evaluateMessage("Génère le FEC maintenant", [
      { code: "documents", label: "Documents", href: "/documents", reason: "Documents" },
    ]);
    const reply = policy.buildBlockedReply(decision);

    expect(decision).toMatchObject({ allowed: false, matchedIntent: "generate_document" });
    expect(reply.content).toContain("Je ne peux pas lancer cette action depuis le chat");
    expect(reply.content).toContain("Ouvrez Documents");
    expect(reply.content).not.toContain("Écrans utiles");
  });

  it("does not block help questions that contain action words", () => {
    const decision = new ChatReadOnlyPolicy().evaluateMessage("Où importer un CSV ?", [
      { code: "imports", label: "Imports", href: "/imports", reason: "Imports" },
    ]);

    expect(decision).toMatchObject({ allowed: true, intent: "navigation_help" });
  });
});

function context(): AccountingChatContext {
  return {
    contextVersion: "test",
    company: "ACME Digital",
    fiscalYear: "2025-01-01 → 2025-12-31",
    references: [{ code: "controle", label: "Contrôle", href: "/controle", reason: "Test" }],
    dashboard: {},
    accountingReview: {},
    closingAdjustments: {},
    journalAudit: {},
    documentFreshness: {},
    annualClosing: {},
  };
}

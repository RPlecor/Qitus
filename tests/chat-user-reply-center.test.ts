import { describe, expect, it } from "vitest";
import { ChatUserReplyCenter, CHAT_USER_FORBIDDEN_TERMS } from "../app/modules/chat/chat-user-reply-center.server";
import type { AccountingChatReply } from "../app/modules/chat/accounting-chat-provider.server";
import type { ChatScopeDecision } from "../app/modules/chat/chat-safety-policy.server";

describe("ChatUserReplyCenter", () => {
  it("composes a natural CSV import answer without blocked wording", () => {
    const reply = new ChatUserReplyCenter().normalizeReply({
      reply: fakeReply(),
      decision: decision("how_to", true),
      history: [{ role: "user", content: "Où importer un CSV ?" }],
      knowledgeSources: [],
      references: [],
    });

    expect(reply.content).toContain("ouvrez Imports");
    expect(reply.content).toContain("correspondance");
    expect(reply.content).not.toContain("lecture seule");
    expectForbiddenTermsAbsent(reply.content);
  });

  it("composes a natural mutation refusal with a destination", () => {
    const reply = new ChatUserReplyCenter().normalizeReply({
      reply: { content: "Écrans utiles : Documents (/documents).", provider: "policy", model: "read-only" },
      decision: {
        ...decision("mutation_request", false),
        refusalKind: "mutation",
        suggestedReferences: [{ code: "documents", label: "Documents", href: "/documents", reason: "Test" }],
      },
      history: [{ role: "user", content: "Génère mon FEC" }],
      knowledgeSources: [],
      references: [{ code: "documents", label: "Documents", href: "/documents", reason: "Test" }],
    });

    expect(reply.content).toBe("Je ne peux pas lancer cette action depuis le chat. Ouvrez Documents pour faire l’action vous-même.");
    expectForbiddenTermsAbsent(reply.content);
  });

  it("sanitizes technical provider text from user-facing replies", () => {
    const reply = new ChatUserReplyCenter().normalizeReply({
      reply: {
        content: "Réponse démo Qitus.\nContexte utilisé : ACME.\nRéférences disponibles : Dashboard /dashboard.\nOuvrez Dashboard.",
        provider: "test",
        model: "test",
      },
      decision: decision("qitus_question", true),
      history: [{ role: "user", content: "Aide-moi" }],
      knowledgeSources: [],
      references: [{ code: "dashboard", label: "Tableau de bord", href: "/dashboard", reason: "Test" }],
    });

    expect(reply.content).toContain("Ouvrez Tableau de bord");
    expectForbiddenTermsAbsent(reply.content);
  });
});

function fakeReply(): AccountingChatReply {
  return {
    content: "Réponse démo Qitus.\nContexte utilisé : ACME.\nRéférences disponibles : Dashboard /dashboard.",
    provider: "fake",
    model: "fake-chat",
  };
}

function decision(intent: ChatScopeDecision["intent"], allowed: boolean): ChatScopeDecision {
  return {
    allowed,
    reason: null,
    matchedIntent: null,
    suggestedReferences: [],
    scope: "qitus_only",
    intent,
  };
}

function expectForbiddenTermsAbsent(content: string) {
  for (const term of CHAT_USER_FORBIDDEN_TERMS) {
    expect(content).not.toContain(term);
  }
}

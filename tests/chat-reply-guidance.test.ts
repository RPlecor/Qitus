import { describe, expect, it } from "vitest";
import { ChatReplyGuidanceCenter } from "../app/modules/chat/chat-reply-guidance-center.server";
import { ChatResolutionCenter } from "../app/modules/chat/chat-resolution-center.server";
import type { AccountingChatContext, AccountingChatProvider } from "../app/modules/chat/accounting-chat-provider.server";

describe("ChatReplyGuidanceCenter", () => {
  it("cleans markdown links and creates an action", () => {
    const reply = new ChatReplyGuidanceCenter().normalizeReply({
      reply: {
        content: "Ouvrez **[Connecteurs](/connecteurs)** pour configurer Qonto.",
        provider: "test",
        model: "test",
      },
      references: [{ code: "connecteurs", label: "Connecteurs", href: "/connecteurs", reason: "Test" }],
    });

    expect(reply.content).toBe("Ouvrez Connecteurs pour configurer Qonto.");
    expect(reply.metadata?.actions).toEqual([
      { label: "Ouvrir Connecteurs", href: "/connecteurs", kind: "primary", source: "markdown" },
    ]);
  });

  it("cleans simple markdown links", () => {
    const reply = new ChatReplyGuidanceCenter().normalizeReply({
      reply: {
        content: "Relancez depuis [Imports](/imports).",
        provider: "test",
        model: "test",
      },
    });

    expect(reply.content).toBe("Relancez depuis Imports.");
    expect(reply.metadata?.actions).toEqual([
      { label: "Ouvrir Imports", href: "/imports", kind: "primary", source: "markdown" },
    ]);
  });

  it("detects navigation wording and deduplicates actions", () => {
    const reply = new ChatReplyGuidanceCenter().normalizeReply({
      reply: {
        content: "Rendez-vous dans TVA, puis ouvrez TVA si le calcul reste à zéro.",
        provider: "test",
        model: "test",
      },
    });

    expect(reply.metadata?.actions).toEqual([
      { label: "Ouvrir TVA", href: "/tva", kind: "primary", source: "reference" },
    ]);
  });

  it("does not turn external or unknown links into actions", () => {
    const reply = new ChatReplyGuidanceCenter().normalizeReply({
      reply: {
        content: "Voir [la documentation](https://example.com) et [une page inconnue](/inconnue).",
        provider: "test",
        model: "test",
      },
    });

    expect(reply.content).toBe("Voir la documentation et une page inconnue.");
    expect(reply.metadata?.actions).toEqual([]);
  });

  it("keeps read-only blocked replies actionable", async () => {
    const center = new ChatResolutionCenter(provider());
    const ctx = context();
    const plan = center.buildPlan("Génère mon FEC maintenant", ctx);
    const reply = await center.resolve(plan, [{ role: "user", content: "Génère mon FEC maintenant" }], ctx);

    expect(reply.content).not.toContain("[");
    expect(reply.metadata?.actions).toEqual([
      { label: "Ouvrir Documents", href: "/documents", kind: "primary", source: "reference" },
      { label: "Ouvrir Contrôle", href: "/controle", kind: "secondary", source: "reference" },
    ]);
  });
});

function provider(): AccountingChatProvider {
  return {
    async reply() {
      return { content: "Réponse test.", provider: "test", model: "test" };
    },
  };
}

function context(): AccountingChatContext {
  return {
    contextVersion: "test",
    company: "ACME Digital",
    fiscalYear: "2025-01-01 → 2025-12-31",
    references: [
      { code: "documents", label: "Documents", href: "/documents", reason: "Test" },
      { code: "controle", label: "Contrôle", href: "/controle", reason: "Test" },
      { code: "connecteurs", label: "Connecteurs", href: "/connecteurs", reason: "Test" },
    ],
    dashboard: {},
    accountingReview: {},
    closingAdjustments: {},
    journalAudit: {},
    documentFreshness: {},
    annualClosing: {},
  };
}

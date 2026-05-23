import { describe, expect, it } from "vitest";
import type { AccountingChatContext, AccountingChatProvider } from "../app/modules/chat/accounting-chat-provider.server";
import { ChatResolutionCenter } from "../app/modules/chat/chat-resolution-center.server";
import { CHAT_HUMAN_LANGUAGE_FORBIDDEN_TERMS } from "../app/modules/chat/chat-human-language-policy.server";

describe("Chat provider independence", () => {
  it.each([
    ["verbose provider", verboseProvider()],
    ["markdown provider", markdownProvider()],
    ["json provider", jsonProvider()],
  ])("%s still returns natural Qitus language and actions", async (_name, provider) => {
    const center = new ChatResolutionCenter(provider);
    const ctx = context();
    const plan = center.buildPlan("Pourquoi mon import est en revue ?", ctx);
    const reply = await center.resolve(plan, [{ role: "user", content: "Pourquoi mon import est en revue ?" }], ctx);

    expect(reply.content).toContain("Imports");
    expect(reply.content).not.toMatch(/\[[^\]]+]\([^)]*\)/);
    for (const term of CHAT_HUMAN_LANGUAGE_FORBIDDEN_TERMS) {
      expect(reply.content.toLocaleLowerCase("fr-FR")).not.toContain(term.toLocaleLowerCase("fr-FR"));
    }
    expect(reply.metadata).toMatchObject({
      intent: "explain_status",
      answerDomain: "qitus_usage",
      providerDraftUsed: true,
    });
    expect(reply.metadata?.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ href: "/imports" }),
    ]));
  });

  it("uses a safe fallback when the provider exposes forbidden language", async () => {
    const center = new ChatResolutionCenter(jsonProvider());
    const ctx = context();
    const plan = center.buildPlan("Pourquoi mon dossier n’est pas à jour ?", ctx);
    const reply = await center.resolve(plan, [{ role: "user", content: "Pourquoi mon dossier n’est pas à jour ?" }], ctx);

    expect(reply.content).not.toContain("JSON");
    expect(reply.content).not.toContain("metadata");
    expect(reply.metadata?.languagePolicyFallback).toBe(true);
    expect(reply.metadata?.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ href: expect.stringMatching(/^\/.+/) }),
    ]));
  });
});

function verboseProvider(): AccountingChatProvider {
  return {
    async reply() {
      return {
        content: "Contexte utilisé : import.\nRéférences disponibles : Dashboard /dashboard.\nÉcrans utiles : Imports (/imports).",
        provider: "verbose",
        model: "test",
      };
    },
  };
}

function markdownProvider(): AccountingChatProvider {
  return {
    async reply() {
      return {
        content: "Pour comprendre l’import, ouvrez **[Imports](/imports)**.",
        provider: "markdown",
        model: "test",
      };
    },
  };
}

function jsonProvider(): AccountingChatProvider {
  return {
    async reply() {
      return {
        content: "Ouvrez Imports avec les détails raw fournis par le provider.",
        provider: "json",
        model: "test",
      };
    },
  };
}

function context(): AccountingChatContext {
  return {
    contextVersion: "test",
    company: "Qitus Démo",
    fiscalYear: "2026-01-01 → 2026-12-31",
    references: [
      { code: "dashboard", label: "Tableau de bord", href: "/dashboard", reason: "Test" },
      { code: "imports", label: "Imports", href: "/imports", reason: "Test" },
      { code: "transactions", label: "Transactions", href: "/transactions", reason: "Test" },
      { code: "pieces", label: "Justificatifs", href: "/pieces", reason: "Test" },
      { code: "tva", label: "TVA", href: "/tva", reason: "Test" },
      { code: "controle", label: "Contrôle", href: "/controle", reason: "Test" },
      { code: "documents", label: "Documents", href: "/documents", reason: "Test" },
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

import { describe, expect, it, vi } from "vitest";
import { buildChatProviderPrompt, FakeChatAdapter, redactChatProviderInput, type AccountingChatContext, type AccountingChatProvider } from "../app/modules/chat/accounting-chat-provider.server";
import { ChatResolutionCenter } from "../app/modules/chat/chat-resolution-center.server";
import { QitusKnowledgeCenter } from "../app/modules/chat/qitus-knowledge-center.server";

describe("Chat P0 Qitus", () => {
  it("finds Qitus sources for product questions", () => {
    const sources = new QitusKnowledgeCenter().search("Pourquoi mon import est en revue ?", { limit: 3 });

    expect(sources.map((source) => source.surface)).toContain("imports");
  });

  it("refuses accounting rule questions before provider execution", async () => {
    const provider = providerSpy();
    const center = new ChatResolutionCenter(provider);
    const plan = center.buildPlan("Quel compte PCG utiliser pour un restaurant ?", context());
    const reply = await center.resolve(plan, [{ role: "user", content: "Quel compte PCG utiliser pour un restaurant ?" }], context());

    expect(plan.requiresProvider).toBe(false);
    expect(provider.reply).not.toHaveBeenCalled();
    expect(reply.content).toContain("règles comptables");
    expect(reply.metadata).toMatchObject({ refused: true, refusalKind: "accounting_rules" });
  });

  it("blocks mutations before provider execution", async () => {
    const provider = providerSpy();
    const center = new ChatResolutionCenter(provider);
    const plan = center.buildPlan("Génère mon FEC maintenant", context());
    const reply = await center.resolve(plan, [{ role: "user", content: "Génère mon FEC maintenant" }], context());

    expect(plan.requiresProvider).toBe(false);
    expect(provider.reply).not.toHaveBeenCalled();
    expect(reply.content).toContain("lecture seule");
  });

  it("calls the provider only with Qitus knowledge sources", async () => {
    const provider = providerSpy();
    const center = new ChatResolutionCenter(provider);
    const plan = center.buildPlan("Pourquoi ma TVA est à zéro ?", context());
    const reply = await center.resolve(plan, [{ role: "user", content: "Pourquoi ma TVA est à zéro ?" }], context());

    expect(plan.requiresProvider).toBe(true);
    expect(plan.knowledgeSources.length).toBeGreaterThan(0);
    expect(provider.reply).toHaveBeenCalledOnce();
    expect(reply.metadata?.knowledgeSources).toEqual(plan.knowledgeSources);
  });

  it("normalizes provider markdown into clean content and actions", async () => {
    const provider: AccountingChatProvider = {
      reply: vi.fn(async () => ({
        content: "Pour configurer Qonto, ouvrez **[Connecteurs](/connecteurs)**.",
        provider: "test",
        model: "test",
      })),
    };
    const center = new ChatResolutionCenter(provider);
    const ctx = context();
    const plan = center.buildPlan("Comment configurer Qonto bancaire ?", ctx);
    const reply = await center.resolve(plan, [{ role: "user", content: "Comment configurer Qonto bancaire ?" }], ctx);

    expect(reply.content).toBe("Pour configurer Qonto, ouvrez Connecteurs.");
    expect(reply.metadata?.actions).toEqual([
      { label: "Ouvrir Connecteurs", href: "/connecteurs", kind: "primary", source: "markdown" },
    ]);
  });

  it("redacts sensitive values before provider prompts", () => {
    const redacted = redactChatProviderInput({
      email: "rene@example.com",
      iban: "FR7612345987650123456789014",
      nested: { token: "sk_test_1234567890", label: "Qitus" },
    });

    const prompt = buildChatProviderPrompt([{ role: "user", content: "Aide-moi" }], {
      ...context(),
      dashboard: redacted,
    });

    expect(prompt).not.toContain("rene@example.com");
    expect(prompt).not.toContain("FR7612345987650123456789014");
    expect(prompt).not.toContain("sk_test_1234567890");
    expect(prompt).toContain("[masqué]");
  });

  it("keeps the fake adapter deterministic and read-only", async () => {
    const reply = await new FakeChatAdapter().reply([{ role: "user", content: "Pourquoi la clôture est bloquée ?" }], context());

    expect(reply).toMatchObject({ provider: "fake", model: "fake-chat" });
    expect(reply.content).toContain("lecture seule");
    expect(reply.content).toContain("ACME Digital");
  });
});

function providerSpy(): AccountingChatProvider {
  return {
    reply: vi.fn(async (_messages, ctx) => ({
      content: "Réponse Qitus sourcée.",
      provider: "test",
      model: "test",
      metadata: { knowledgeSources: ctx.knowledgeSources ?? [] },
    })),
  };
}

function context(): AccountingChatContext {
  return {
    contextVersion: "test",
    company: "ACME Digital",
    fiscalYear: "2025-01-01 → 2025-12-31",
    references: [
      { code: "dashboard", label: "Tableau de bord", href: "/dashboard", reason: "Test" },
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

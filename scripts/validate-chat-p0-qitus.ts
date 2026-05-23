import scenarios from "../fixtures/chat-scenarios/qitus-p0-golden.json" assert { type: "json" };
import { ChatResolutionCenter } from "../app/modules/chat/chat-resolution-center.server";
import type { AccountingChatContext, AccountingChatProvider } from "../app/modules/chat/accounting-chat-provider.server";

const provider: AccountingChatProvider = {
  async reply(_messages, context) {
    return {
      content: `Réponse Qitus sourcée. Sources: ${(context.knowledgeSources ?? []).map((source) => source.title).join(", ")}.`,
      provider: "validation",
      model: "deterministic",
      metadata: { knowledgeSources: context.knowledgeSources ?? [] },
    };
  },
};

const center = new ChatResolutionCenter(provider);

for (const scenario of scenarios) {
  const plan = center.buildPlan(scenario.question, context());
  const reply = await center.resolve(plan, [{ role: "user", content: scenario.question }], context());
  if (scenario.expectedSurface === "chat") {
    if (plan.requiresProvider || !isRefused(reply.metadata)) {
      throw new Error(`${scenario.question}: expected refusal.`);
    }
  } else {
    const surfaces = plan.knowledgeSources.map((source) => source.surface);
    if (!surfaces.includes(scenario.expectedSurface) && !reply.content.includes("lecture seule")) {
      throw new Error(`${scenario.question}: missing expected surface ${scenario.expectedSurface}. Got ${surfaces.join(", ")}`);
    }
  }
  console.log(`✓ ${scenario.question}`);
}

function isRefused(metadata: unknown) {
  return Boolean(metadata && typeof metadata === "object" && "refused" in metadata && metadata.refused === true);
}

function context(): AccountingChatContext {
  return {
    contextVersion: "validation",
    company: "Qitus Démo",
    fiscalYear: "2026-01-01 → 2026-12-31",
    references: [
      { code: "dashboard", label: "Tableau de bord", href: "/dashboard", reason: "Validation" },
      { code: "imports", label: "Imports", href: "/imports", reason: "Validation" },
      { code: "tva", label: "TVA", href: "/tva", reason: "Validation" },
      { code: "documents", label: "Documents", href: "/documents", reason: "Validation" },
      { code: "controle", label: "Contrôle", href: "/controle", reason: "Validation" },
    ],
    dashboard: {},
    accountingReview: {},
    closingAdjustments: {},
    journalAudit: {},
    documentFreshness: {},
    annualClosing: {},
  };
}

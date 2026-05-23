import { describe, expect, it } from "vitest";
import { AccountingRulesAnswerCenter } from "../app/modules/chat/accounting-rules-answer-center.server";

describe("AccountingRulesAnswerCenter", () => {
  it("prepares a sourced-answer contract without exposing a final mutation path", () => {
    const draft = new AccountingRulesAnswerCenter().answerWithoutSources([
      { role: "user", content: "Quel compte PCG utiliser pour un restaurant ?" },
    ]);

    expect(draft.answerDraft).toContain("Je ne peux pas répondre de façon fiable");
    expect(draft.provider).toBe("qitus-accounting-rules");
    expect(draft.confidence).toBe(1);
    expect(draft.usedSourceIds).toEqual([]);
    expect(draft.suggestedRouteHrefs).toEqual([]);
    expect(draft.rawMetadata).toMatchObject({ answerDomain: "accounting_rules" });
  });
});

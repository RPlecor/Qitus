import { describe, expect, it } from "vitest";
import { ChatHumanLanguagePolicy, CHAT_HUMAN_LANGUAGE_FORBIDDEN_TERMS } from "../app/modules/chat/chat-human-language-policy.server";

describe("ChatHumanLanguagePolicy", () => {
  it("rejects forbidden technical terms case-insensitively", () => {
    const policy = new ChatHumanLanguagePolicy();

    for (const term of CHAT_HUMAN_LANGUAGE_FORBIDDEN_TERMS) {
      const result = policy.validateReply({ content: `Voici un ${term.toUpperCase()} visible.`, provider: "test", model: "test" });
      expect(result.ok, term).toBe(false);
      expect(result.forbiddenTerms).toContain(term);
    }
  });

  it("allows useful accounting vocabulary", () => {
    const result = new ChatHumanLanguagePolicy().validateReply({
      content: "La TVA, le FEC, les OD, les écritures, le journal, le rapprochement, le débit et le crédit sont visibles dans Qitus.",
      provider: "test",
      model: "test",
    });

    expect(result.ok).toBe(true);
  });
});

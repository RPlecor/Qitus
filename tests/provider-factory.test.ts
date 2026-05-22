import { afterEach, describe, expect, it, vi } from "vitest";
import { FakeCategorizationProvider, OpenAIResponsesCategorizationAdapter } from "../app/modules/categorization/ai-provider";
import { CodexCliCategorizationAdapter } from "../app/modules/categorization/codex-cli-provider";
import { createAiCategorizationProvider } from "../app/modules/categorization/provider-factory.server";

describe("AI provider factory", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the fake provider when AI_PROVIDER=fake", () => {
    vi.stubEnv("AI_PROVIDER", "fake");
    vi.stubEnv("OPENAI_API_KEY", "");

    expect(createAiCategorizationProvider()).toBeInstanceOf(FakeCategorizationProvider);
  });

  it("uses Codex CLI in auto mode", () => {
    vi.stubEnv("AI_PROVIDER", "auto");
    vi.stubEnv("OPENAI_API_KEY", "");

    expect(createAiCategorizationProvider()).toBeInstanceOf(CodexCliCategorizationAdapter);
  });

  it("uses Codex CLI when AI_PROVIDER=codex-cli", () => {
    vi.stubEnv("AI_PROVIDER", "codex-cli");
    vi.stubEnv("OPENAI_API_KEY", "");

    expect(createAiCategorizationProvider()).toBeInstanceOf(CodexCliCategorizationAdapter);
  });

  it("uses OpenAI when AI_PROVIDER=openai and an API key is present", () => {
    vi.stubEnv("AI_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "sk-test");

    expect(createAiCategorizationProvider()).toBeInstanceOf(OpenAIResponsesCategorizationAdapter);
  });

  it("fails loudly when OpenAI is forced without a key", () => {
    vi.stubEnv("AI_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "");

    expect(() => createAiCategorizationProvider()).toThrow("AI_PROVIDER=openai requires OPENAI_API_KEY");
  });
});

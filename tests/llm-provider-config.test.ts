import { describe, expect, it } from "vitest";
import { getConfiguredAgentProvider } from "../app/modules/llm-provider-config.server";

describe("LLM provider config", () => {
  it("uses the configured categorization provider", () => {
    expect(getConfiguredAgentProvider("categorization")).toBe("codex-cli");
  });
});

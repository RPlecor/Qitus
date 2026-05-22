import { getAiProviderMode, getCodexCliBin, getCodexModel, getOpenAiModel, requireOpenAiApiKey } from "../env.server";
import { getConfiguredAgentProvider } from "../llm-provider-config.server";
import { FakeCategorizationProvider, OpenAIResponsesCategorizationAdapter } from "./ai-provider";
import { CodexCliCategorizationAdapter } from "./codex-cli-provider";
import type { AiCategorizationProvider } from "./types";

export function createAiCategorizationProvider(): AiCategorizationProvider {
  const mode = process.env.AI_PROVIDER ? getAiProviderMode() : getConfiguredAgentProvider("categorization");

  if (mode === "fake") return new FakeCategorizationProvider();
  if (mode === "codex-cli" || mode === "auto") {
    return new CodexCliCategorizationAdapter({
      codexBin: getCodexCliBin(),
      model: getCodexModel(),
      cwd: process.cwd(),
    });
  }
  if (mode === "openai") {
    return new OpenAIResponsesCategorizationAdapter({
      apiKey: requireOpenAiApiKey(),
      model: getOpenAiModel(),
    });
  }

  return new CodexCliCategorizationAdapter({
    codexBin: getCodexCliBin(),
    model: getCodexModel(),
    cwd: process.cwd(),
  });
}

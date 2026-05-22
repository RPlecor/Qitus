import { config } from "dotenv";
import { getRuntimeConfig, parseAiProvider, type AiProviderMode } from "./runtime-config.server";

config({ quiet: true });

export type { AiProviderMode };

export function getAiProviderMode(): AiProviderMode {
  return parseAiProvider(process.env.AI_PROVIDER);
}

export function getCodexCliBin() {
  return getRuntimeConfig().codexCliBin;
}

export function getCodexModel() {
  return getRuntimeConfig().codexModel;
}

export function getOpenAiModel() {
  return getRuntimeConfig().openAiModel;
}

export function requireOpenAiApiKey() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("AI_PROVIDER=openai requires OPENAI_API_KEY in the server environment.");
  }
  return process.env.OPENAI_API_KEY;
}

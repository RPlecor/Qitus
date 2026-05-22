import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { AiProviderMode } from "./env.server";

type ProvidersConfig = Record<string, { enabled?: boolean; kind?: string; model?: string }>;
type AgentsConfig = Record<string, { provider?: string; role?: string }>;

export function getConfiguredAgentProvider(agentName = "categorization"): AiProviderMode {
  const agents = readJson<AgentsConfig>("config/agents.json");
  const providers = readJson<ProvidersConfig>("config/llm-providers.json");
  const providerName = agents[agentName]?.provider ?? "codex-cli";
  const provider = providers[providerName];

  if (!provider?.enabled) return "fake";
  if (provider.kind === "codex-cli" || providerName === "codex-cli") return "codex-cli";
  if (provider.kind === "openai-responses" || providerName === "openai") return "openai";
  return "fake";
}

function readJson<T>(relativePath: string): T {
  const filePath = path.join(process.cwd(), relativePath);
  if (!existsSync(filePath)) return {} as T;
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

import { spawn } from "node:child_process";
import OpenAI from "openai";
import type { RuntimeConfig } from "../runtime-config.server";
import { getRuntimeConfig } from "../runtime-config.server";
import type { ChatReference } from "./chat-answer-grounding.server";
import type { QitusKnowledgeSource } from "./qitus-knowledge-center.server";

export type AccountingChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type AccountingChatContext = {
  contextVersion: string;
  company: string;
  fiscalYear: string;
  references: ChatReference[];
  dashboard: unknown;
  accountingReview: unknown;
  closingAdjustments: unknown;
  journalAudit: unknown;
  documentFreshness: unknown;
  annualClosing: unknown;
  knowledgeSources?: QitusKnowledgeSource[];
};

export type AccountingChatReply = {
  content: string;
  provider: string;
  model: string;
  metadata?: Record<string, unknown>;
};

export interface AccountingChatProvider {
  reply(messages: AccountingChatMessage[], context: AccountingChatContext): Promise<AccountingChatReply>;
}

export class FakeChatAdapter implements AccountingChatProvider {
  async reply(messages: AccountingChatMessage[], context: AccountingChatContext): Promise<AccountingChatReply> {
    const question = messages.filter((message) => message.role === "user").at(-1)?.content ?? "";
    return {
      content: [
        "Réponse démo Qitus.",
        `Votre question : ${question}`,
        `Contexte utilisé : ${context.company}, exercice ${context.fiscalYear}.`,
        `Références disponibles : ${context.references.map((reference) => `${reference.label} ${reference.href}`).join(", ")}.`,
        "Le chat est en lecture seule : il peut expliquer les blocages et indiquer les écrans à ouvrir, mais ne modifie aucune donnée comptable.",
      ].join("\n"),
      provider: "fake",
      model: "fake-chat",
      metadata: { fake: true, references: context.references },
    };
  }
}

export class CodexCliChatAdapter implements AccountingChatProvider {
  private readonly config: RuntimeConfig;
  private readonly timeoutMs: number;

  constructor(config: RuntimeConfig = getRuntimeConfig(), timeoutMs = 120_000) {
    this.config = config;
    this.timeoutMs = timeoutMs;
  }

  async reply(messages: AccountingChatMessage[], context: AccountingChatContext): Promise<AccountingChatReply> {
    const content = await runCodexCli({
      codexBin: this.config.codexCliBin,
      model: this.config.chatModel,
      cwd: process.cwd(),
      prompt: buildPrompt(messages, redactChatProviderInput(context) as AccountingChatContext, this.config.chatMaxContextChars),
      timeoutMs: this.timeoutMs,
    });
    return {
      content,
      provider: "codex-cli",
      model: this.config.chatModel,
      metadata: { readOnly: true },
    };
  }
}

export class OpenAiChatAdapter implements AccountingChatProvider {
  private readonly client: OpenAI;

  constructor(private readonly config: RuntimeConfig = getRuntimeConfig()) {
    const apiKey = config.chatOpenAiApiKey ?? config.openAiApiKey;
    if (!apiKey) throw new Error("CHAT_PROVIDER=openai requires CHAT_OPENAI_API_KEY or OPENAI_API_KEY.");
    this.client = new OpenAI({ apiKey });
  }

  async reply(messages: AccountingChatMessage[], context: AccountingChatContext): Promise<AccountingChatReply> {
    const safeContext = redactChatProviderInput(context) as AccountingChatContext;
    const completion = await this.client.chat.completions.create({
      model: this.config.chatModel,
      temperature: 0.1,
      messages: [
        { role: "system", content: buildSystemInstruction() },
        { role: "user", content: buildPrompt(messages, safeContext, this.config.chatMaxContextChars) },
      ],
    });
    return {
      content: completion.choices[0]?.message.content?.trim() || "Je n'ai pas de réponse fiable à partir des sources Qitus disponibles.",
      provider: "openai",
      model: this.config.chatModel,
      metadata: { readOnly: true, qitusOnly: true, sources: safeContext.knowledgeSources ?? [] },
    };
  }
}

export function createAccountingChatProvider(config: RuntimeConfig = getRuntimeConfig()): AccountingChatProvider {
  if (config.chatProvider === "fake" || process.env.NODE_ENV === "test") return new FakeChatAdapter();
  if (config.chatProvider === "openai") return new OpenAiChatAdapter(config);
  return new CodexCliChatAdapter(config);
}

function buildSystemInstruction() {
  return [
    "Tu es Assistant Qitus, un assistant produit en lecture seule.",
    "Périmètre V1: répondre uniquement aux questions d'utilisation de Qitus, de navigation, d'état du dossier, d'actions à réaliser et de compréhension des écrans.",
    "Tu ne donnes pas d'avis comptable personnalisé, juridique ou fiscal. Les règles comptables générales seront couvertes en V2.",
    "Tu ne déclenches aucune mutation et tu ne promets jamais d'avoir effectué une action.",
    "Tu réponds en français, brièvement, avec des étapes concrètes et des liens Qitus quand ils sont disponibles.",
    "Tu peux citer les noms d'écrans Qitus, mais Qitus gère l'affichage final des liens sous forme de boutons.",
    "Utilise les noms visibles à l'écran: Tableau de bord, Imports, Transactions, Justificatifs, Connecteurs, TVA, Contrôle, Documents.",
    "Si les sources Qitus fournies ne permettent pas de répondre, dis-le explicitement au lieu d'inventer.",
  ].join("\n");
}

export function buildChatProviderPrompt(messages: AccountingChatMessage[], context: AccountingChatContext, maxChars = 16_000) {
  return trimToMaxChars([
    buildSystemInstruction(),
    "Tu es le chat comptable Qitus pour une beta locale.",
    "Tu es strictement en lecture seule : tu n'appelles aucun outil et tu ne demandes jamais de mutation comptable.",
    "Réponds en français, de manière concise et utile.",
    "Tu dois fonder ta réponse sur le contexte JSON fourni et citer les écrans Qitus pertinents depuis context.references.",
    "Si la demande ressemble à une action (corriger, générer, valider, clôturer, changer de plan), explique que le chat ne peut pas le faire et indique l'écran où l'utilisateur doit confirmer lui-même.",
    "Si une information manque dans le contexte, dis-le clairement au lieu d'inventer.",
    "",
    "CONTEXTE JSON:",
    JSON.stringify(context, null, 2),
    "",
    "CONVERSATION:",
    messages.map((message) => `${message.role.toUpperCase()}: ${message.content}`).join("\n"),
    "",
    "Réponse:",
  ].join("\n"), maxChars);
}

function buildPrompt(messages: AccountingChatMessage[], context: AccountingChatContext, maxChars = 16_000) {
  return buildChatProviderPrompt(messages, context, maxChars);
}

export function redactChatProviderInput(value: unknown): unknown {
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.map(redactChatProviderInput);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, isSensitiveKey(key) ? "[masqué]" : redactChatProviderInput(entry)]));
  }
  return value;
}

function redactString(value: string) {
  return value
    .replace(/\bFR\d{2}[A-Z0-9]{11,30}\b/gi, "[IBAN masqué]")
    .replace(/\b(?:sk|pk|whsec|rk)_(?:live|test)?_[A-Za-z0-9_=-]{8,}\b/g, "[secret masqué]")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}\b/gi, "[email masqué]");
}

function isSensitiveKey(key: string) {
  return /(secret|token|apikey|api_key|password|iban|siret|siren)/i.test(key);
}

function trimToMaxChars(value: string, maxChars: number) {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}\n\n[Contexte tronqué pour limiter les données transmises au provider.]`;
}

function runCodexCli(input: { codexBin: string; model: string; cwd: string; prompt: string; timeoutMs: number }) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(input.codexBin, [
      "exec",
      "--model",
      input.model,
      "--cd",
      input.cwd,
      "--skip-git-repo-check",
      "--sandbox",
      "read-only",
      "-",
    ], { cwd: input.cwd, env: process.env });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, input.timeoutMs);
    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (timedOut) {
        reject(new Error("Codex CLI a dépassé le délai de réponse."));
        return;
      }
      if (code && code !== 0) {
        reject(new Error(cleanCodexError(stderr || stdout || `Codex CLI exited with code ${code}.`)));
        return;
      }
      resolve(cleanCodexOutput(stdout));
    });
    child.stdin.end(input.prompt);
  });
}

function cleanCodexOutput(output: string) {
  const trimmed = output.trim();
  return trimmed || "Codex CLI n'a pas retourné de réponse exploitable.";
}

function cleanCodexError(output: string) {
  if (output.includes("login") || output.includes("auth")) {
    return "Codex CLI n'est pas connecté. Lancez `codex --login` puis choisissez Sign in with ChatGPT.";
  }
  return output.split("\n")[0] || "Codex CLI n'a pas pu répondre.";
}

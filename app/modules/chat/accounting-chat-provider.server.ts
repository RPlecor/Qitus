import { spawn } from "node:child_process";
import type { RuntimeConfig } from "../runtime-config.server";
import { getRuntimeConfig } from "../runtime-config.server";
import type { ChatReference } from "./chat-answer-grounding.server";

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
        "Réponse démo Paperasse.",
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
      prompt: buildPrompt(messages, context),
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

export function createAccountingChatProvider(config: RuntimeConfig = getRuntimeConfig()): AccountingChatProvider {
  if (config.chatProvider === "fake" || process.env.NODE_ENV === "test") return new FakeChatAdapter();
  return new CodexCliChatAdapter(config);
}

function buildPrompt(messages: AccountingChatMessage[], context: AccountingChatContext) {
  return [
    "Tu es le chat comptable Paperasse pour une beta locale.",
    "Tu es strictement en lecture seule : tu n'appelles aucun outil et tu ne demandes jamais de mutation comptable.",
    "Réponds en français, de manière concise et utile.",
    "Tu dois fonder ta réponse sur le contexte JSON fourni et citer les écrans Paperasse pertinents depuis context.references.",
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
  ].join("\n");
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

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AiCategorizationProvider, CategorizationContext, CategorizationSuggestion, CategorizationTransaction } from "./types";

const outputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["categorizations"],
  properties: {
    categorizations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "transactionId",
          "accountDebit",
          "accountDebitLabel",
          "accountCredit",
          "accountCreditLabel",
          "journal",
          "ecritureLabel",
          "confidence",
          "rationale",
          "isAnnualCharge",
          "alternatives",
        ],
        properties: {
          transactionId: { type: "string" },
          accountDebit: { type: "string" },
          accountDebitLabel: { type: ["string", "null"] },
          accountCredit: { type: "string" },
          accountCreditLabel: { type: ["string", "null"] },
          journal: { type: "string" },
          ecritureLabel: { type: "string" },
          confidence: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
          rationale: { type: ["string", "null"] },
          isAnnualCharge: { type: "boolean" },
          alternatives: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["account", "label", "confidence"],
              properties: {
                account: { type: "string" },
                label: { type: ["string", "null"] },
                confidence: { type: "number" },
              },
            },
          },
        },
      },
    },
  },
};

export type CodexCliRunnerInput = {
  codexBin: string;
  model: string;
  cwd: string;
  prompt: string;
  schemaPath: string;
  outputPath: string;
  timeoutMs: number;
};

export type CodexCliRunner = (input: CodexCliRunnerInput) => Promise<string>;

export class CodexCliCategorizationAdapter implements AiCategorizationProvider {
  private readonly codexBin: string;
  private readonly model: string;
  private readonly cwd: string;
  private readonly timeoutMs: number;
  private readonly runner: CodexCliRunner;

  constructor(options?: {
    codexBin?: string;
    model?: string;
    cwd?: string;
    timeoutMs?: number;
    runner?: CodexCliRunner;
  }) {
    this.codexBin = options?.codexBin ?? process.env.CODEX_CLI_BIN ?? "codex";
    this.model = options?.model ?? process.env.CODEX_MODEL ?? "gpt-5.4-mini";
    this.cwd = options?.cwd ?? process.cwd();
    this.timeoutMs = options?.timeoutMs ?? 120_000;
    this.runner = options?.runner ?? runCodexCli;
  }

  async categorize(transactions: CategorizationTransaction[], context: CategorizationContext): Promise<CategorizationSuggestion[]> {
    if (transactions.length === 0) return [];

    const dir = await mkdtemp(path.join(tmpdir(), "qitus-codex-"));
    const schemaPath = path.join(dir, "categorization.schema.json");
    const outputPath = path.join(dir, "categorization.output.json");

    try {
      await writeFile(schemaPath, JSON.stringify(outputSchema, null, 2));
      const raw = await this.runner({
        codexBin: this.codexBin,
        model: this.model,
        cwd: this.cwd,
        prompt: buildPrompt(transactions, context),
        schemaPath,
        outputPath,
        timeoutMs: this.timeoutMs,
      });
      const parsed = JSON.parse(raw) as { categorizations?: RawCodexCategorization[] };
      return (parsed.categorizations ?? []).map((suggestion) => ({
        transactionId: suggestion.transactionId,
        accountDebit: suggestion.accountDebit,
        accountDebitLabel: nullableToUndefined(suggestion.accountDebitLabel),
        accountCredit: suggestion.accountCredit ?? "5121",
        accountCreditLabel: nullableToUndefined(suggestion.accountCreditLabel),
        journal: suggestion.journal ?? "BQ",
        ecritureLabel: suggestion.ecritureLabel,
        confidence: suggestion.confidence,
        rationale: nullableToUndefined(suggestion.rationale),
        isAnnualCharge: suggestion.isAnnualCharge,
        alternatives: (suggestion.alternatives ?? []).map((alternative) => ({
          account: alternative.account,
          label: nullableToUndefined(alternative.label),
          confidence: alternative.confidence,
        })),
        source: "AI",
      }));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
}

type RawCodexCategorization = Omit<CategorizationSuggestion, "source" | "accountDebitLabel" | "accountCreditLabel" | "rationale" | "alternatives"> & {
  accountDebitLabel: string | null;
  accountCreditLabel: string | null;
  rationale: string | null;
  alternatives: Array<{ account: string; label: string | null; confidence: number }>;
};

function nullableToUndefined<T>(value: T | null): T | undefined {
  return value ?? undefined;
}

async function runCodexCli(input: CodexCliRunnerInput): Promise<string> {
  const { stdout, stderr } = await spawnCodexCli(input.codexBin, {
    args: [
      "exec",
      "--json",
      "--model",
      input.model,
      "--cd",
      input.cwd,
      "--skip-git-repo-check",
      "--sandbox",
      "read-only",
      "--output-schema",
      input.schemaPath,
      "--output-last-message",
      input.outputPath,
      "-",
    ],
    cwd: input.cwd,
    env: { ...process.env },
    prompt: input.prompt,
    timeoutMs: input.timeoutMs,
  });

  const lastMessage = await readFile(input.outputPath, "utf8").catch(() => "");
  if (lastMessage.trim()) return lastMessage;

  return parseCodexJsonlOutput(`${stdout}\n${stderr}`);
}

function spawnCodexCli(
  codexBin: string,
  options: { args: string[]; cwd: string; env: NodeJS.ProcessEnv; prompt: string; timeoutMs: number }
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(codexBin, options.args, { cwd: options.cwd, env: options.env });
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, options.timeoutMs);

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
    child.on("close", (code, signal) => {
      clearTimeout(timeout);
      if (timedOut) {
        reject(new Error(`Codex CLI timed out after ${options.timeoutMs}ms.`));
        return;
      }
      if (code && code !== 0) {
        reject(new Error(`Codex CLI exited with code ${code}${signal ? ` (${signal})` : ""}: ${stderr || stdout}`));
        return;
      }
      resolve({ stdout, stderr });
    });

    child.stdin.end(options.prompt);
  });
}

export function parseCodexJsonlOutput(output: string): string {
  let finalText: string | null = null;
  let failureMessage: string | null = null;

  for (const line of output.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;

    try {
      const event = JSON.parse(trimmed) as {
        type?: string;
        message?: string;
        item?: { type?: string; text?: string };
        error?: { message?: string };
      };
      if (event.type === "item.completed" && event.item?.type === "agent_message" && typeof event.item.text === "string") {
        finalText = event.item.text;
      }
      if (event.type === "turn.failed" || event.type === "error") {
        failureMessage = event.error?.message ?? event.message ?? "Codex CLI turn failed.";
      }
    } catch {
      continue;
    }
  }

  if (failureMessage) throw new Error(`Codex CLI failed: ${failureMessage}`);
  if (!finalText) throw new Error("Codex CLI did not return a final agent message.");
  return finalText;
}

function buildPrompt(transactions: CategorizationTransaction[], context: CategorizationContext) {
  return [
    "Tu es le provider IA local Qitus execute via Codex CLI connecte au compte ChatGPT de l'utilisateur.",
    "Ta mission: categoriser des transactions bancaires pour une comptabilite francaise MVP.",
    "Respecte strictement le schema JSON fourni par --output-schema.",
    "Retourne une categorisation par transaction d'entree, dans le meme ordre.",
    "Utilise le journal BQ et le Plan Comptable General francais.",
    "Pour les debits bancaires: debit = compte de charge/attente, credit = 5121.",
    "Pour les credits bancaires: debit = 5121, credit = compte de produit/attente.",
    "Si le libelle est opaque, insuffisant ou ambigu: confidence LOW, compte 471, rationale courte.",
    "Ne cree jamais de categorisation HIGH pour une transaction incertaine.",
    "",
    JSON.stringify({
      company: {
        name: context.companyName,
        legalForm: context.legalForm,
        vatRegime: context.vatRegime,
      },
      knownVendorMappings: context.vendorMappings,
      transactions,
      requestId: randomUUID(),
    }),
  ].join("\n");
}

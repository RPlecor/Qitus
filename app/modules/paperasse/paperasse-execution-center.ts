import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { GeneratedArtifact, PaperasseScriptResult, PaperasseWorkDir, PaperasseWorkDirInput } from "./types";
import { PaperasseRuntime, PaperasseScriptError } from "./paperasse-runtime";

export type PaperasseDocumentScript = "fec" | "statements" | "pdfs";

export type PaperasseExecutionResult = PaperasseScriptResult & {
  args: string[];
  startedAt: string;
  finishedAt: string;
  userMessage: string;
};

export type PaperasseExecution = PaperasseWorkDir & {
  results: PaperasseExecutionResult[];
};

export class PaperasseExecutionError extends Error {
  constructor(
    message: string,
    readonly result: PaperasseExecutionResult
  ) {
    super(message);
  }
}

export class PaperasseExecutionCenter {
  constructor(private readonly runtime: PaperasseRuntime) {}

  async prepareExecution(input: PaperasseWorkDirInput): Promise<PaperasseExecution> {
    return { ...(await this.runtime.prepareWorkDir(input)), results: [] };
  }

  async runDocumentScript(execution: PaperasseExecution, script: PaperasseDocumentScript): Promise<PaperasseExecutionResult> {
    const spec = scriptSpec(script, execution.outputPath);
    const startedAt = new Date();
    try {
      const result = await this.runtime.runScript(execution, spec.filename, spec.args, spec.timeoutMs);
      const structured = toExecutionResult(result, spec.args, startedAt, new Date(), userMessage(result));
      execution.results.push(structured);
      return structured;
    } catch (error) {
      if (error instanceof PaperasseScriptError) {
        const structured = toExecutionResult(error.result, spec.args, startedAt, new Date(), error.message);
        execution.results.push(structured);
        throw new PaperasseExecutionError(error.message, structured);
      }
      const fallback: PaperasseExecutionResult = {
        script: spec.filename,
        args: spec.args,
        exitCode: 1,
        stdout: "",
        stderr: error instanceof Error ? error.message : String(error),
        timedOut: false,
        timeoutMs: spec.timeoutMs,
        scriptVersion: execution.scriptVersion,
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        userMessage: error instanceof Error ? error.message : "Le script Qitus a échoué.",
      };
      execution.results.push(fallback);
      throw new PaperasseExecutionError(fallback.userMessage, fallback);
    }
  }

  async collectArtifacts(execution: PaperasseExecution, scripts: PaperasseDocumentScript[]): Promise<GeneratedArtifact[]> {
    const artifacts: GeneratedArtifact[] = [];
    if (scripts.includes("fec")) artifacts.push(await artifactMatching(execution.outputPath, "FEC", /^.+FEC\d{8}\.txt$/, "txt"));
    if (scripts.includes("statements")) {
      artifacts.push(
        await artifact(execution.outputPath, "COMPTE_RESULTAT", "compte-de-resultat.md", "md"),
        await artifact(execution.outputPath, "BILAN", "bilan.md", "md"),
        await artifact(execution.outputPath, "BALANCE", "balance.md", "md")
      );
    }
    return artifacts;
  }

  async cleanupExecution(execution: PaperasseExecution) {
    await this.runtime.cleanupWorkDir(execution);
  }
}

function scriptSpec(script: PaperasseDocumentScript, outputPath: string) {
  if (script === "fec") return { filename: "generate-fec.js", args: ["--output", outputPath], timeoutMs: 60_000 };
  if (script === "pdfs") return { filename: "generate-pdfs.js", args: ["--input", outputPath, "--output", path.join(outputPath, "pdf")], timeoutMs: 120_000 };
  return { filename: "generate-statements.js", args: ["--output", outputPath], timeoutMs: 60_000 };
}

function toExecutionResult(
  result: PaperasseScriptResult,
  args: string[],
  startedAt: Date,
  finishedAt: Date,
  userMessageText: string
): PaperasseExecutionResult {
  return {
    ...result,
    args,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    userMessage: userMessageText,
  };
}

function userMessage(result: PaperasseScriptResult) {
  return result.exitCode === 0 ? `Le script Qitus ${result.script} s'est terminé correctement.` : `Le script Qitus ${result.script} a échoué.`;
}

async function artifact(outputPath: string, type: GeneratedArtifact["type"], filename: string, format: string): Promise<GeneratedArtifact> {
  const artifactPath = path.join(outputPath, filename);
  const stats = await stat(artifactPath);
  return { type, filename, path: artifactPath, format, sizeBytes: stats.size };
}

async function artifactMatching(outputPath: string, type: GeneratedArtifact["type"], pattern: RegExp, format: string): Promise<GeneratedArtifact> {
  const filename = (await readdir(outputPath)).find((candidate) => pattern.test(candidate));
  if (!filename) throw new Error(`Qitus did not generate expected ${type} artifact in ${outputPath}`);
  return artifact(outputPath, type, filename, format);
}

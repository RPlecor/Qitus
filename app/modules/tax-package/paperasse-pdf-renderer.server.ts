import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { PaperasseExecutionCenter, PaperasseExecutionError } from "../paperasse/paperasse-execution-center";
import { PaperasseRuntime } from "../paperasse/paperasse-runtime";
import type { PaperasseWorkDirInput } from "../paperasse/types";

export type PaperassePdfRenderResult =
  | { status: "disabled"; userMessage: string }
  | { status: "failed"; userMessage: string }
  | { status: "ready"; path: string; filename: string; sizeBytes: number; scriptVersion?: string; userMessage: string };

export class PaperassePdfRenderer {
  constructor(
    private readonly runtime = new PaperasseRuntime({
      repoPath: process.env.PAPERASSE_REPO_PATH ?? "./vendor/paperasse",
      enablePdfGeneration: process.env.ENABLE_PDF_GENERATION === "1",
    }),
    private readonly executionCenter = new PaperasseExecutionCenter(runtime)
  ) {}

  async renderPdfFromStructuredSource(input: PaperasseWorkDirInput & { sourceMarkdown: string }): Promise<PaperassePdfRenderResult> {
    if (process.env.ENABLE_PDF_GENERATION !== "1") return { status: "disabled", userMessage: "Rendu PDF désactivé. Source structurée conservée." };

    const execution = await this.executionCenter.prepareExecution(input);
    try {
      await mkdir(execution.outputPath, { recursive: true });
      await writeFile(path.join(execution.outputPath, "pre-liasse-fiscale.md"), input.sourceMarkdown, "utf8");
      await this.executionCenter.runDocumentScript(execution, "pdfs");
      const pdfDir = path.join(execution.outputPath, "pdf");
      const filename = (await readdir(pdfDir)).find((candidate) => candidate === "pre-liasse-fiscale.pdf" || candidate === "liasse-fiscale-2033.pdf");
      if (!filename) return { status: "failed", userMessage: "Le script PDF n'a pas produit la liasse fiscale." };
      const pdfPath = path.join(pdfDir, filename);
      const stats = await stat(pdfPath);
      return {
        status: "ready",
        path: pdfPath,
        filename,
        sizeBytes: stats.size,
        scriptVersion: execution.scriptVersion,
        userMessage: "PDF de liasse généré.",
      };
    } catch (error) {
      const userMessage = error instanceof PaperasseExecutionError ? error.result.userMessage : error instanceof Error ? error.message : String(error);
      return { status: "failed", userMessage };
    } finally {
      await this.executionCenter.cleanupExecution(execution);
    }
  }
}

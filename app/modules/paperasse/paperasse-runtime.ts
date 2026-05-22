import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access, cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { GeneratedArtifact, PaperasseCompanyInput, PaperasseScriptResult, PaperasseWorkDir, PaperasseWorkDirInput } from "./types";

export class PaperasseScriptError extends Error {
  constructor(
    message: string,
    readonly result: PaperasseScriptResult
  ) {
    super(message);
  }
}

export class PaperasseRuntime {
  constructor(
    private readonly options: {
      repoPath: string;
      tmpRoot?: string;
      enablePdfGeneration?: boolean;
    }
  ) {}

  toCompanyJson(company: PaperasseCompanyInput) {
    const bank = company.bankAccounts[0] ?? { id: "bank-1", label: "Banque principale", pcgAccount: "5121", fecAccount: "51211" };
    return {
      name: company.name,
      legal_form: company.legalForm,
      capital: company.capital ?? 0,
      address: [company.addressStreet, company.addressPostal, company.addressCity].filter(Boolean).join(", "),
      siren: company.siren ?? "",
      siret: company.siret ?? "",
      rcs: company.rcs ?? "",
      naf: company.nafCode ?? "",
      president: {
        title: company.managerRole ?? (company.legalForm.includes("SARL") ? "Gerant" : "President"),
        first_name: company.managerFirstName ?? "",
        last_name: company.managerLastName ?? "",
        civility: company.managerCivility ?? "",
      },
      fiscal_year: {
        start: company.fiscalYearStart,
        end: company.fiscalYearEnd,
        is_first_year: false,
      },
      tax: {
        regime_tva: mapVatRegime(company.vatRegime),
        regime_is: company.corporateTax === "IR" ? "ir" : "reel_simplifie",
        tva_rate: company.vatRate ?? 0.2,
      },
      banks: [
        {
          id: bank.id,
          name: bank.label,
          account: bank.pcgAccount,
          fec_account: bank.fecAccount ?? "51211",
        },
      ],
      qonto: { enabled: false },
      stripe_accounts: [],
      city: company.addressCity ?? "",
      invoicing: {
        prefix: "F",
        separator: "-",
        year_format: "YYYY",
        next_numbers: { [company.fiscalYearStart.slice(0, 4)]: 1 },
        avoir_prefix: "AV",
      },
      einvoicing: {
        pa: "",
        pa_name: "",
        peppol_id: company.siret ? `0225:${company.siret}` : "",
        reception_ready: false,
        emission_ready: false,
        ereporting_ready: false,
      },
      payment: {
        default_terms: "net_30",
        default_terms_label: "30 jours date de facture",
        methods: ["virement"],
        bank_details: { iban: "", bic: "" },
        late_penalty_rate: "3x_legal",
        late_penalty_label: "3 fois le taux d'interet legal",
        escompte: "none",
        escompte_label: "Pas d'escompte pour paiement anticipe",
        recovery_fee: 40,
      },
    };
  }

  async prepareWorkDir(input: PaperasseWorkDirInput): Promise<PaperasseWorkDir> {
    await this.assertRepoPresent();
    const root = this.options.tmpRoot ?? path.join(process.cwd(), "tmp");
    const workDir = path.join(root, `qitus-${input.companyId}-${input.jobId}`);
    const outputPath = path.join(workDir, "output");

    await rm(workDir, { recursive: true, force: true });
    await mkdir(path.join(workDir, "data"), { recursive: true });
    await mkdir(outputPath, { recursive: true });
    await cp(path.join(this.options.repoPath, "scripts"), path.join(workDir, "scripts"), { recursive: true });
    await cp(path.join(this.options.repoPath, "templates"), path.join(workDir, "templates"), { recursive: true });
    await cp(path.join(this.options.repoPath, "data", "pcg_2026.json"), path.join(workDir, "data", "pcg_2026.json"));
    await cp(path.join(this.options.repoPath, "data", "nomenclature-liasse-fiscale.csv"), path.join(workDir, "data", "nomenclature-liasse-fiscale.csv"));
    await cp(path.join(this.options.repoPath, "data", "sources.json"), path.join(workDir, "data", "sources.json"));
    await writeFile(path.join(workDir, "package.json"), JSON.stringify({ type: "commonjs" }, null, 2));
    await writeFile(path.join(workDir, "company.json"), JSON.stringify(this.toCompanyJson(input.company), null, 2));
    await writeFile(path.join(workDir, "data", "journal-entries.json"), JSON.stringify(toPaperasseEntries(input.entries), null, 2));

    return {
      path: workDir,
      outputPath,
      scriptVersion: await this.readScriptVersion(),
    };
  }

  async runFec(workDir: PaperasseWorkDir): Promise<GeneratedArtifact> {
    await this.runNodeScript(workDir, "generate-fec.js", ["--output", workDir.outputPath]);
    return this.artifactMatching(workDir.outputPath, "FEC", /^.+FEC\d{8}\.txt$/, "txt");
  }

  async runStatements(workDir: PaperasseWorkDir): Promise<GeneratedArtifact[]> {
    await this.runNodeScript(workDir, "generate-statements.js", ["--output", workDir.outputPath]);
    return Promise.all([
      this.artifact(workDir.outputPath, "COMPTE_RESULTAT", "compte-de-resultat.md", "md"),
      this.artifact(workDir.outputPath, "BILAN", "bilan.md", "md"),
      this.artifact(workDir.outputPath, "BALANCE", "balance.md", "md"),
    ]);
  }

  async runPdfs(workDir: PaperasseWorkDir): Promise<GeneratedArtifact[]> {
    if (!this.options.enablePdfGeneration) return [];
    const pdfDir = path.join(workDir.outputPath, "pdf");
    await this.runNodeScript(workDir, "generate-pdfs.js", ["--input", workDir.outputPath, "--output", pdfDir], 120_000);
    return [];
  }

  async runScript(workDir: PaperasseWorkDir, script: string, args: string[], timeout = 60_000) {
    return this.runNodeScript(workDir, script, args, timeout);
  }

  async cleanupWorkDir(workDir: PaperasseWorkDir): Promise<void> {
    await rm(workDir.path, { recursive: true, force: true });
  }

  private async runNodeScript(workDir: PaperasseWorkDir, script: string, args: string[], timeout = 60_000): Promise<PaperasseScriptResult> {
    return new Promise((resolve, reject) => {
      const child = execFile("node", [path.join("scripts", script), ...args], {
        cwd: workDir.path,
        timeout,
        env: { ...process.env },
      });
      let stdout = "";
      let stderr = "";

      child.stdout?.on("data", (chunk) => {
        stdout += String(chunk);
      });
      child.stderr?.on("data", (chunk) => {
        stderr += String(chunk);
      });
      child.on("error", (error) => {
        reject(new PaperasseScriptError(userScriptMessage(script, error.message), {
          script,
          exitCode: 1,
          stdout,
          stderr,
          timedOut: false,
          timeoutMs: timeout,
          scriptVersion: workDir.scriptVersion,
        }));
      });
      child.on("close", (code, signal) => {
        const timedOut = signal === "SIGTERM" && code === null;
        const result: PaperasseScriptResult = {
          script,
          exitCode: code ?? (timedOut ? 124 : 1),
          stdout,
          stderr,
          timedOut,
          timeoutMs: timeout,
          scriptVersion: workDir.scriptVersion,
        };
        if (result.exitCode !== 0 || timedOut) {
          reject(new PaperasseScriptError(userScriptMessage(script, stderr || stdout || signal || "script failed"), result));
          return;
        }
        resolve(result);
      });
    });
  }

  private async artifact(outputPath: string, type: GeneratedArtifact["type"], filename: string, format: string): Promise<GeneratedArtifact> {
    const artifactPath = path.join(outputPath, filename);
    const stats = await stat(artifactPath);
    return { type, filename, path: artifactPath, format, sizeBytes: stats.size };
  }

  private async artifactMatching(outputPath: string, type: GeneratedArtifact["type"], pattern: RegExp, format: string): Promise<GeneratedArtifact> {
    const filename = (await readdir(outputPath)).find((candidate) => pattern.test(candidate));
    if (!filename) throw new Error(`Qitus did not generate expected ${type} artifact in ${outputPath}`);
    return this.artifact(outputPath, type, filename, format);
  }

  private async assertRepoPresent() {
    await access(path.join(this.options.repoPath, "scripts"), constants.R_OK);
    await access(path.join(this.options.repoPath, "templates"), constants.R_OK);
  }

  private async readScriptVersion() {
    try {
      return (await readFile(path.join(this.options.repoPath, ".git", "HEAD"), "utf8")).trim();
    } catch {
      return "unknown";
    }
  }
}

function userScriptMessage(script: string, detail: string) {
  const firstLine = detail.split(/\r?\n/).find(Boolean) ?? "échec inconnu";
  return `Le script Qitus ${script} a échoué : ${firstLine}`;
}

function toPaperasseEntries(entries: PaperasseWorkDirInput["entries"]) {
  return entries.map((entry) => ({
    num: entry.num,
    date: entry.date,
    journal: entry.journal,
    ref: entry.ref,
    label: entry.label,
    lines: entry.lines.map((line) => ({
      account: line.account,
      debit: line.debit,
      credit: line.credit,
    })),
  }));
}

function mapVatRegime(regime: string) {
  if (regime === "FRANCHISE") return "franchise";
  if (regime === "REEL_NORMAL") return "reel_normal";
  return "reel_simplifie";
}

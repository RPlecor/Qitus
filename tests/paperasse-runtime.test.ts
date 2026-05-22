import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PaperasseRuntime, PaperasseScriptError } from "../app/modules/paperasse/paperasse-runtime";

describe("PaperasseRuntime", () => {
  it("maps Company data to the real Paperasse company.json shape", () => {
    const runtime = new PaperasseRuntime({ repoPath: "./vendor/paperasse" });
    const company = runtime.toCompanyJson({
      name: "ACME Digital",
      legalForm: "SASU",
      capital: 1000,
      siren: "912345678",
      siret: "91234567800015",
      nafCode: "6202A",
      rcs: "RCS Paris",
      addressStreet: "42 rue de la Paix",
      addressPostal: "75002",
      addressCity: "Paris",
      managerFirstName: "Marie",
      managerLastName: "Dupont",
      managerCivility: "Mme",
      managerRole: "President",
      fiscalYearStart: "2025-01-01",
      fiscalYearEnd: "2025-12-31",
      vatRegime: "FRANCHISE",
      corporateTax: "IS",
      bankAccounts: [{ id: "bank-1", label: "Compte principal", pcgAccount: "5121", fecAccount: "51211" }],
    });

    expect(company).toMatchObject({
      name: "ACME Digital",
      legal_form: "SASU",
      tax: { regime_tva: "franchise", regime_is: "reel_simplifie" },
      banks: [{ account: "5121", fec_account: "51211" }],
    });
  });

  it("isolates copied Paperasse CommonJS scripts from the Remix ESM package", async () => {
    const tmpRoot = await mkdtemp(path.join(tmpdir(), "paperasse-runtime-test-"));
    const runtime = new PaperasseRuntime({ repoPath: "./vendor/paperasse", tmpRoot });
    const workDir = await runtime.prepareWorkDir({
      companyId: "company-test",
      jobId: "job-test",
      company: {
        name: "ACME Digital",
        legalForm: "SASU",
        fiscalYearStart: "2025-01-01",
        fiscalYearEnd: "2025-12-31",
        vatRegime: "FRANCHISE",
        corporateTax: "IS",
        bankAccounts: [{ id: "bank-1", label: "Compte principal", pcgAccount: "5121", fecAccount: "51211" }],
      },
      entries: [],
    });

    try {
      await expect(readFile(path.join(workDir.path, "package.json"), "utf8")).resolves.toContain("\"type\": \"commonjs\"");
    } finally {
      await rm(tmpRoot, { recursive: true, force: true });
    }
  });

  it("runs the real FEC script and returns the generated regulatory filename", async () => {
    const tmpRoot = await mkdtemp(path.join(tmpdir(), "paperasse-runtime-fec-test-"));
    const runtime = new PaperasseRuntime({ repoPath: "./vendor/paperasse", tmpRoot });
    const workDir = await runtime.prepareWorkDir({
      companyId: "company-test",
      jobId: "job-test",
      company: {
        name: "ACME Digital",
        legalForm: "SASU",
        siren: "912345678",
        fiscalYearStart: "2025-01-01",
        fiscalYearEnd: "2025-12-31",
        vatRegime: "FRANCHISE",
        corporateTax: "IS",
        bankAccounts: [{ id: "bank-1", label: "Compte principal", pcgAccount: "5121", fecAccount: "51211" }],
      },
      entries: [
        {
          num: 1,
          date: "2025-01-03",
          journal: "BQ",
          ref: "QTO-001",
          label: "OVH CLOUD HOSTING JANVIER",
          source: "IMPORT",
          transactionId: "txn-1",
          lines: [
            { account: "6135", debit: 29.99, credit: 0 },
            { account: "5121", debit: 0, credit: 29.99 },
          ],
        },
      ],
    });

    try {
      const artifact = await runtime.runFec(workDir);
      expect(artifact.filename).toBe("912345678FEC20251231.txt");
      await expect(readFile(artifact.path, "utf8")).resolves.toContain("JournalCode|JournalLib|EcritureNum");
    } finally {
      await rm(tmpRoot, { recursive: true, force: true });
    }
  });

  it("surfaces Paperasse script failures with stdout, stderr, timeout and script version", async () => {
    const tmpRoot = await mkdtemp(path.join(tmpdir(), "paperasse-runtime-error-test-"));
    const repoPath = path.join(tmpRoot, "repo");
    await mkdir(path.join(repoPath, "scripts"), { recursive: true });
    await mkdir(path.join(repoPath, "templates"), { recursive: true });
    await mkdir(path.join(repoPath, "data"), { recursive: true });
    await writeFile(path.join(repoPath, "data", "pcg_2026.json"), "{}");
    await writeFile(path.join(repoPath, "data", "nomenclature-liasse-fiscale.csv"), "");
    await writeFile(path.join(repoPath, "data", "sources.json"), "{}");
    await writeFile(path.join(repoPath, "scripts", "fail.js"), "console.error('boom'); process.exit(2);");

    const runtime = new PaperasseRuntime({ repoPath, tmpRoot });
    const workDir = await runtime.prepareWorkDir({
      companyId: "company-test",
      jobId: "job-test",
      company: {
        name: "ACME Digital",
        legalForm: "SASU",
        fiscalYearStart: "2025-01-01",
        fiscalYearEnd: "2025-12-31",
        vatRegime: "FRANCHISE",
        corporateTax: "IS",
        bankAccounts: [{ id: "bank-1", label: "Compte principal", pcgAccount: "5121", fecAccount: "51211" }],
      },
      entries: [],
    });

    await expect(runtime.runScript(workDir, "fail.js", [])).rejects.toMatchObject({
      result: {
        script: "fail.js",
        exitCode: 2,
        stdout: "",
        stderr: expect.stringContaining("boom"),
        timedOut: false,
        timeoutMs: 60000,
        scriptVersion: "unknown",
      },
    } satisfies Partial<PaperasseScriptError>);

    await rm(tmpRoot, { recursive: true, force: true });
  });
});

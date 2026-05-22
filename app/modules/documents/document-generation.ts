import type { JournalEntryDraft } from "../ledger/ledger-writer";
import { PaperasseExecutionCenter } from "../paperasse/paperasse-execution-center";
import type { PaperasseCompanyInput } from "../paperasse/types";
import { PaperasseRuntime } from "../paperasse/paperasse-runtime";
import { LocalDocumentStorageAdapter, type DocumentStorageAdapter } from "./document-storage-adapter.server";

export type StoredDocument = {
  type: string;
  filename: string;
  storageKey: string;
  format: string;
  sizeBytes: number;
  generatedBy: string;
  scriptVersion?: string;
};

export class DocumentGeneration {
  constructor(
    runtime: PaperasseRuntime,
    private readonly storage: DocumentStorageAdapter = new LocalDocumentStorageAdapter(),
    private readonly executionCenter = new PaperasseExecutionCenter(runtime)
  ) {}

  async generate(input: {
    companyId: string;
    fiscalYearId: string;
    jobId: string;
    company: PaperasseCompanyInput;
    entries: JournalEntryDraft[];
    types: Array<"fec" | "statements">;
  }): Promise<StoredDocument[]> {
    const execution = await this.executionCenter.prepareExecution(input);
    try {
      if (input.types.includes("fec")) await this.executionCenter.runDocumentScript(execution, "fec");
      if (input.types.includes("statements")) await this.executionCenter.runDocumentScript(execution, "statements");
      const artifacts = await this.executionCenter.collectArtifacts(execution, input.types);

      const stored: StoredDocument[] = [];
      for (const artifact of artifacts) {
        const storageKey = `${input.companyId}/${input.fiscalYearId}/${input.jobId}/${artifact.filename}`;
        const storageResult = await this.storage.put(artifact.path, storageKey);
        stored.push({
          type: artifact.type,
          filename: artifact.filename,
          storageKey: storageResult.key,
          format: artifact.format,
          sizeBytes: storageResult.sizeBytes,
          generatedBy: artifact.type === "FEC" ? "script:generate-fec" : "script:generate-statements",
          scriptVersion: execution.scriptVersion,
        });
      }
      return stored;
    } finally {
      await this.executionCenter.cleanupExecution(execution);
    }
  }
}

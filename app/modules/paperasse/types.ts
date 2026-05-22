import type { JournalEntryDraft } from "../ledger/ledger-writer";

export type PaperasseCompanyInput = {
  name: string;
  legalForm: string;
  capital?: number | null;
  addressStreet?: string | null;
  addressPostal?: string | null;
  addressCity?: string | null;
  siren?: string | null;
  siret?: string | null;
  rcs?: string | null;
  nafCode?: string | null;
  managerFirstName?: string | null;
  managerLastName?: string | null;
  managerCivility?: string | null;
  managerRole?: string | null;
  fiscalYearStart: string;
  fiscalYearEnd: string;
  vatRegime: string;
  corporateTax?: string | null;
  vatRate?: number | null;
  bankAccounts: Array<{ id: string; label: string; pcgAccount: string; fecAccount?: string | null }>;
};

export type PaperasseWorkDirInput = {
  companyId: string;
  jobId: string;
  company: PaperasseCompanyInput;
  entries: JournalEntryDraft[];
};

export type PaperasseWorkDir = {
  path: string;
  outputPath: string;
  scriptVersion?: string;
};

export type GeneratedArtifact = {
  type: "FEC" | "BALANCE" | "BILAN" | "COMPTE_RESULTAT" | "PDF_BUNDLE";
  filename: string;
  path: string;
  format: string;
  sizeBytes: number;
};

export type PaperasseScriptResult = {
  script: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  timeoutMs: number;
  scriptVersion?: string;
};

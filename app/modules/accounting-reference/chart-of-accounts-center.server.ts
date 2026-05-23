import pcg2026 from "./pcg-2026.json";

export type PcgAccount = {
  code: string;
  label: string;
  class: string;
  parent: string | null;
  system: string;
  isPostable: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  sourceUrl: string;
  sourceChecksum: string;
  sourceVersion: string;
};

export type ChartValidationResult = {
  ok: boolean;
  version: string;
  accountCount: number;
  missingCriticalAccounts: string[];
  sourceUrl: string;
  sourceChecksum: string;
};

type RawPcgAccount = {
  number: number | string;
  label: string;
  system: string;
  parent: number | string | null;
};

type RawPcgData = {
  version: number | string;
  flat: RawPcgAccount[];
};

const OFFICIAL_PCG_METADATA = {
  sourceUrl: "https://www.anc.gouv.fr/plan-comptable-general-0",
  sourceDocumentUrl: "https://www.anc.gouv.fr/files/anc/files/1_Normes_fran%C3%A7aises/Plans%20comptables/2026/Plan-de-comptes-2026.pdf",
  sourceChecksum: "d95c47d7621552e26412b0a4285542815d02c9522f2e0f4d813410576a34f0e4",
  sourceVersion: "ANC-PCG-2026-01-01",
  effectiveFrom: "2026-01-01",
} as const;

const CRITICAL_QITUS_ACCOUNTS = [
  "401",
  "411",
  "4452",
  "44551",
  "44566",
  "44567",
  "44571",
  "471",
  "5121",
  "6135",
  "6161",
  "6226",
  "6251",
  "6257",
  "627",
  "6451",
  "706",
] as const;

export class ChartOfAccountsCenter {
  private readonly accounts: Map<string, PcgAccount>;

  constructor(data: RawPcgData = pcg2026 as RawPcgData) {
    this.accounts = new Map(data.flat.map((account) => {
      const code = String(account.number);
      return [code, normalizeAccount(account, data.version)];
    }));
  }

  getActiveChartVersion() {
    return OFFICIAL_PCG_METADATA.sourceVersion;
  }

  getSourceMetadata() {
    return OFFICIAL_PCG_METADATA;
  }

  getAccount(code: string | number | null | undefined): PcgAccount | null {
    if (code === null || code === undefined || code === "") return null;
    return this.accounts.get(normalizeCode(code)) ?? null;
  }

  isKnownAccount(code: string | number | null | undefined) {
    return Boolean(this.getAccount(code));
  }

  isPostableAccount(code: string | number | null | undefined) {
    return this.getAccount(code)?.isPostable === true;
  }

  listAccounts(filters?: { classes?: string[]; postableOnly?: boolean }) {
    return [...this.accounts.values()].filter((account) => {
      if (filters?.classes && !filters.classes.includes(account.class)) return false;
      if (filters?.postableOnly && !account.isPostable) return false;
      return true;
    });
  }

  validateChartIntegrity(): ChartValidationResult {
    const missingCriticalAccounts = CRITICAL_QITUS_ACCOUNTS.filter((account) => !this.isKnownAccount(account));
    return {
      ok: this.accounts.size >= 800 && missingCriticalAccounts.length === 0 && Boolean(OFFICIAL_PCG_METADATA.sourceChecksum),
      version: this.getActiveChartVersion(),
      accountCount: this.accounts.size,
      missingCriticalAccounts,
      sourceUrl: OFFICIAL_PCG_METADATA.sourceUrl,
      sourceChecksum: OFFICIAL_PCG_METADATA.sourceChecksum,
    };
  }
}

export function normalizeCode(code: string | number) {
  return String(code).trim();
}

function normalizeAccount(account: RawPcgAccount, version: number | string): PcgAccount {
  const code = normalizeCode(account.number);
  return {
    code,
    label: account.label,
    class: code.slice(0, 1),
    parent: account.parent === null ? null : normalizeCode(account.parent),
    system: account.system,
    isPostable: code.length >= 3,
    effectiveFrom: OFFICIAL_PCG_METADATA.effectiveFrom,
    effectiveTo: null,
    sourceUrl: OFFICIAL_PCG_METADATA.sourceDocumentUrl,
    sourceChecksum: OFFICIAL_PCG_METADATA.sourceChecksum,
    sourceVersion: `PCG-${version}`,
  };
}

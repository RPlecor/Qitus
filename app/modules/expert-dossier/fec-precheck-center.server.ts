import { DocumentType, VatRegime } from "@prisma/client";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { DocumentCatalog, type DocumentCatalogItem } from "../documents/document-catalog.server";
import { JournalAuditCenter, type JournalAuditSummary } from "../journal/journal-audit-center.server";
import { FecComplianceReferenceCenter } from "../official-references/fec-compliance-reference-center.server";
import { VatReferenceCenter } from "../official-references/vat-reference-center.server";
import { ExpectedRouteError } from "../route-errors.server";

export type FecPrecheckIssue = {
  code: "MISSING_FEC" | "STALE_FEC" | "JOURNAL_NOT_EXPORTABLE" | "ENTRY_COUNT_MISMATCH" | "MISSING_VAT_ACCOUNTS" | "UNEXPECTED_FORMAT";
  severity: "blocking" | "warning";
  label: string;
  detail: string;
};

export type FecPrecheck = {
  status: "ready" | "blocked" | "warning";
  label: string;
  fec: DocumentCatalogItem | null;
  journal: JournalAuditSummary;
  issues: FecPrecheckIssue[];
  blockingCount: number;
  warningCount: number;
};

export class FecPrecheckCenter {
  constructor(
    private readonly documents = new DocumentCatalog(),
    private readonly journalAudit = new JournalAuditCenter(),
    private readonly fecReference = new FecComplianceReferenceCenter(),
    private readonly vatReference = new VatReferenceCenter()
  ) {}

  async getFecPrecheck(workspace: CompanyWorkspace): Promise<FecPrecheck> {
    await this.fecReference.assertReady();
    const expectedVatAccounts = Object.values(await this.vatReference.getVatAccounts());
    const [documents, journal, hasVatLines] = await Promise.all([
      this.documents.listDocuments(workspace),
      this.journalAudit.getAuditSummary(workspace),
      this.hasVatLines(workspace),
    ]);
    const fec = documents.find((document) => document.type === DocumentType.FEC) ?? null;
    const issues = [
      ...(!fec ? [issue("MISSING_FEC", "blocking", "FEC absent", "Le fichier FEC doit être généré avant revue cabinet.")] : []),
      ...(fec?.freshness?.isStale ? [issue("STALE_FEC", "blocking", "FEC à régénérer", "Le FEC est antérieur à un événement comptable.")] : []),
      ...(fec && fec.format !== "txt" ? [issue("UNEXPECTED_FORMAT", "warning", "Format FEC inattendu", "Le FEC officiel attendu est un fichier .txt.")] : []),
      ...(fec?.entriesCount != null && fec.entriesCount !== journal.summary.entriesCount
        ? [issue("ENTRY_COUNT_MISMATCH", "blocking", "Nombre d'écritures incohérent", `FEC : ${fec.entriesCount}, journal : ${journal.summary.entriesCount}.`)]
        : []),
      ...(journal.status !== "exportable"
        ? [issue("JOURNAL_NOT_EXPORTABLE", "blocking", "Journal non exportable", "Le journal contient des anomalies bloquantes.")]
        : []),
      ...(workspace.company.vatRegime !== VatRegime.FRANCHISE && !hasVatLines
        ? [issue("MISSING_VAT_ACCOUNTS", "warning", "Comptes TVA non détectés", `Aucune ligne TVA attendue (${expectedVatAccounts.join(", ")}) n'a été trouvée malgré un régime réel.`)]
        : []),
    ];
    const blockingCount = issues.filter((item) => item.severity === "blocking").length;
    const warningCount = issues.length - blockingCount;
    return {
      status: blockingCount > 0 ? "blocked" : warningCount > 0 ? "warning" : "ready",
      label: blockingCount > 0 ? "FEC à corriger" : warningCount > 0 ? "FEC prêt avec alertes" : "FEC précontrôlé",
      fec,
      journal,
      issues,
      blockingCount,
      warningCount,
    };
  }

  async listFecIssues(workspace: CompanyWorkspace) {
    return (await this.getFecPrecheck(workspace)).issues;
  }

  async compareFecToJournal(workspace: CompanyWorkspace) {
    const precheck = await this.getFecPrecheck(workspace);
    return {
      fecEntriesCount: precheck.fec?.entriesCount ?? null,
      journalEntriesCount: precheck.journal.summary.entriesCount,
      matches: precheck.fec?.entriesCount === precheck.journal.summary.entriesCount,
    };
  }

  async assertFecExportable(workspace: CompanyWorkspace) {
    const precheck = await this.getFecPrecheck(workspace);
    if (precheck.blockingCount > 0) throw new ExpectedRouteError(precheck.issues[0]?.detail ?? "FEC non exportable.", 409);
    return precheck;
  }

  private async hasVatLines(workspace: CompanyWorkspace) {
    const vatAccounts = Object.values(await this.vatReference.getVatAccounts());
    const count = await prisma.journalLine.count({
      where: {
        journalEntry: { fiscalYearId: workspace.fiscalYear.id },
        account: { in: vatAccounts },
      },
    });
    return count > 0;
  }
}

function issue(code: FecPrecheckIssue["code"], severity: FecPrecheckIssue["severity"], label: string, detail: string): FecPrecheckIssue {
  return { code, severity, label, detail };
}

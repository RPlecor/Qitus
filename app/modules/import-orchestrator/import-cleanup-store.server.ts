import type { ImportSource, PrismaClient } from "@prisma/client";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { ExpectedRouteError } from "../route-errors.server";
import type { ImportCleanupPreview } from "./import-cleanup-center.server";

type Db = PrismaClient;

export class ImportCleanupStore {
  constructor(private readonly db: Db = prisma) {}

  async previewImportDeletion(workspace: CompanyWorkspace, importId: string): Promise<ImportCleanupPreview> {
    return this.buildPreview(workspace, [importId], { requireAll: true });
  }

  async previewFiscalYearImportReset(workspace: CompanyWorkspace): Promise<ImportCleanupPreview> {
    const imports = await this.db.import.findMany({
      where: { fiscalYearId: workspace.fiscalYear.id },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });
    return this.buildPreview(workspace, imports.map((row) => row.id), { requireAll: false });
  }

  async deleteImports(workspace: CompanyWorkspace, importIds: string[]): Promise<ImportCleanupPreview> {
    if (importIds.length === 0) return emptyPreview();

    return this.db.$transaction(async (tx) => {
      const preview = await this.buildPreviewWithClient(tx as Db, workspace, importIds, { requireAll: true });
      const runningImportCount = await tx.import.count({
        where: {
          fiscalYearId: workspace.fiscalYear.id,
          id: { in: importIds },
          status: { in: ["PENDING", "PARSING", "CATEGORIZING"] },
        },
      });
      if (runningImportCount > 0) {
        throw new ExpectedRouteError("Impossible de supprimer un import en cours. Attendez la fin du traitement puis réessayez.", 409);
      }
      const journalEntryIds = await listImportJournalEntryIds(tx as Db, workspace.fiscalYear.id, importIds);

      if (journalEntryIds.length > 0) {
        await tx.journalEntry.deleteMany({
          where: {
            fiscalYearId: workspace.fiscalYear.id,
            id: { in: journalEntryIds },
            source: "IMPORT",
          },
        });
      }

      await tx.import.deleteMany({
        where: {
          fiscalYearId: workspace.fiscalYear.id,
          id: { in: importIds },
        },
      });

      return preview;
    });
  }

  private async buildPreview(workspace: CompanyWorkspace, importIds: string[], options: { requireAll: boolean }) {
    return this.buildPreviewWithClient(this.db, workspace, importIds, options);
  }

  private async buildPreviewWithClient(db: Db, workspace: CompanyWorkspace, importIds: string[], options: { requireAll: boolean }): Promise<ImportCleanupPreview> {
    if (importIds.length === 0) return emptyPreview();
    const imports = await db.import.findMany({
      where: {
        fiscalYearId: workspace.fiscalYear.id,
        id: { in: importIds },
      },
      select: { id: true, sourceType: true },
    });

    if (options.requireAll && imports.length !== unique(importIds).length) {
      throw new ExpectedRouteError("Import introuvable pour cet exercice.", 404);
    }

    const scopedImportIds = imports.map((row) => row.id);
    if (scopedImportIds.length === 0) return emptyPreview();

    const [transactionCount, journalEntryIds] = await Promise.all([
      db.transaction.count({
        where: { fiscalYearId: workspace.fiscalYear.id, importId: { in: scopedImportIds } },
      }),
      listImportJournalEntryIds(db, workspace.fiscalYear.id, scopedImportIds),
    ]);

    const journalLineCount = journalEntryIds.length === 0
      ? 0
      : await db.journalLine.count({ where: { journalEntryId: { in: journalEntryIds } } });

    return {
      importIds: scopedImportIds,
      importCount: scopedImportIds.length,
      transactionCount,
      journalEntryCount: journalEntryIds.length,
      journalLineCount,
      sources: unique(imports.map((row) => row.sourceType)),
      warnings: warningsFor({ transactionCount, journalEntryCount: journalEntryIds.length }),
    };
  }
}

async function listImportJournalEntryIds(db: Db, fiscalYearId: string, importIds: string[]) {
  const rows = await db.transaction.findMany({
    where: {
      fiscalYearId,
      importId: { in: importIds },
      journalEntryId: { not: null },
      journalEntry: { source: "IMPORT" },
    },
    select: { journalEntryId: true },
  });
  return unique(rows.flatMap((row) => row.journalEntryId ? [row.journalEntryId] : []));
}

function emptyPreview(): ImportCleanupPreview {
  return {
    importIds: [],
    importCount: 0,
    transactionCount: 0,
    journalEntryCount: 0,
    journalLineCount: 0,
    sources: [],
    warnings: [],
  };
}

function warningsFor(counts: { transactionCount: number; journalEntryCount: number }) {
  if (counts.transactionCount === 0 && counts.journalEntryCount === 0) return [];
  return [
    "Les documents, la TVA, les rapprochements et le dossier EC pourront devoir être régénérés ou relancés.",
    "Les pièces justificatives sont conservées et peuvent apparaître comme pièces sans écriture.",
  ];
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

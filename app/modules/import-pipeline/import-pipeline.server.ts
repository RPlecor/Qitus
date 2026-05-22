import { ImportStatus } from "@prisma/client";
import { prisma } from "../db.server";
import { parseBankCsv } from "./parsers";
import type { ColumnMapping } from "./types";

export async function ingestCsvImport(input: {
  fiscalYearId: string;
  bankAccountId: string;
  filename: string;
  content: string;
  mapping?: ColumnMapping;
}) {
  const parsed = parseBankCsv({ content: input.content, mapping: input.mapping });
  const importRow = await prisma.import.create({
    data: {
      fiscalYearId: input.fiscalYearId,
      bankAccountId: input.bankAccountId,
      originalFilename: input.filename,
      fileFormat: parsed.detection.format,
      fileSeparator: parsed.detection.separator,
      detectedColumns: parsed.detection.columns,
      columnMapping: input.mapping ?? undefined,
      status: parsed.detection.needsMapping ? ImportStatus.NEEDS_MAPPING : ImportStatus.CATEGORIZING,
      totalRows: parsed.rowCount,
      parsedRows: parsed.transactions.length,
      startedAt: new Date(),
    },
  });

  if (parsed.detection.needsMapping) {
    return { import: importRow, transactions: [] };
  }

  const existing = await prisma.transaction.findMany({
    where: { fiscalYearId: input.fiscalYearId },
    select: { date: true, amount: true, normalizedLabel: true, sourceRef: true },
  });
  const seen = new Set(existing.map((tx) => fingerprint(tx.date.toISOString().slice(0, 10), tx.amount.toString(), tx.normalizedLabel, tx.sourceRef)));

  const created = [];
  for (const tx of parsed.transactions) {
    const key = fingerprint(tx.date, String(tx.amount), tx.normalizedLabel, tx.sourceRef);
    if (seen.has(key)) continue;
    seen.add(key);
    created.push(await prisma.transaction.create({
      data: {
        fiscalYearId: input.fiscalYearId,
        importId: importRow.id,
        sourceId: tx.sourceId,
        date: new Date(tx.date),
        label: tx.label,
        normalizedLabel: tx.normalizedLabel,
        counterparty: tx.counterparty,
        amount: tx.amount,
        currency: tx.currency,
        type: tx.type,
        sourceRef: tx.sourceRef,
        sourceCategory: tx.sourceCategory,
        notes: tx.notes,
      },
    }));
  }

  return { import: importRow, transactions: created };
}

function fingerprint(date: string, amount: string, normalizedLabel: string, sourceRef?: string | null) {
  return [date, amount, normalizedLabel, sourceRef ?? ""].join("|");
}

import { parse } from "csv-parse/sync";
import type { BankFormat, ColumnMapping, CsvDetection, NormalizedTransaction, ParseCsvInput, ParseCsvResult } from "./types";

const qontoHeaders = ["ID de l'opération", "Date de l'opération", "Montant total (EUR)", "Sens", "Contrepartie"];
const bnpHeaders = ["Date opération", "Libellé", "Montant(EUR)"];
const sgHeaders = ["Date", "Libellé opération", "Détail opération", "Montant opération"];
const boursoramaHeaders = ["dateOp", "dateVal", "label", "amount"];

export function detectCsv(content: string): CsvDetection {
  const firstLine = content.split(/\r?\n/).find((line) => line.trim().length > 0) ?? "";
  const separator = firstLine.includes(";") ? ";" : ",";
  const columns = firstLine.split(separator).map((column) => column.trim().replace(/^\uFEFF/, ""));

  const format = detectFormat(columns);
  return {
    format,
    separator,
    columns,
    needsMapping: format === "generic",
  };
}

export function parseBankCsv(input: ParseCsvInput): ParseCsvResult {
  const detection = detectCsv(input.content);
  const records = parse(input.content, {
    columns: true,
    bom: true,
    delimiter: detection.separator,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  if (detection.format === "generic" && !input.mapping) {
    return { detection, rowCount: records.length, transactions: [] };
  }

  const transactions = records.map((record, index) => normalizeRecord(detection.format, record, index, input.mapping));
  return { detection, rowCount: records.length, transactions };
}

function detectFormat(columns: string[]): BankFormat {
  if (containsAll(columns, qontoHeaders)) return "qonto";
  if (containsAll(columns, bnpHeaders)) return "bnp";
  if (containsAll(columns, sgHeaders)) return "sg";
  if (containsAll(columns, boursoramaHeaders)) return "boursorama";
  return "generic";
}

function normalizeRecord(format: BankFormat, record: Record<string, string>, index: number, mapping?: ColumnMapping): NormalizedTransaction {
  if (format === "qonto") {
    const amount = parseFrenchAmount(record["Montant total (EUR)"]);
    return makeTransaction({
      sourceId: record["ID de l'opération"],
      date: record["Date de l'opération"],
      label: record["Libellé de l'opération"],
      counterparty: record["Contrepartie"],
      amount,
      sourceRef: record["Référence"],
      sourceCategory: record["Catégorie"],
      index,
    });
  }

  if (format === "bnp") {
    const amount = parseFrenchAmount(record["Montant(EUR)"]);
    return makeTransaction({
      date: toIsoDate(record["Date opération"]),
      label: record["Libellé"],
      counterparty: extractCounterparty(record["Libellé"]),
      amount,
      sourceRef: record["Référence opération"],
      index,
    });
  }

  if (format === "sg") {
    const amount = parseFrenchAmount(record["Montant opération"]);
    const label = [record["Libellé opération"], record["Détail opération"]].filter(Boolean).join(" ");
    return makeTransaction({
      date: toIsoDate(record["Date"]),
      label,
      counterparty: extractCounterparty(label),
      amount,
      index,
    });
  }

  if (format === "boursorama") {
    const amount = Number(record.amount);
    return makeTransaction({
      date: record.dateOp,
      label: record.label,
      counterparty: extractCounterparty(record.label),
      amount,
      sourceCategory: record.categoryName,
      index,
    });
  }

  if (!mapping) {
    throw new Error("Generic CSV requires a column mapping");
  }

  const amount = parseFrenchAmount(record[mapping.amount]);
  return makeTransaction({
    sourceId: mapping.sourceId ? record[mapping.sourceId] : undefined,
    date: toIsoDate(record[mapping.date]),
    label: record[mapping.label],
    counterparty: mapping.counterparty ? record[mapping.counterparty] : extractCounterparty(record[mapping.label]),
    amount,
    sourceRef: mapping.sourceRef ? record[mapping.sourceRef] : undefined,
    sourceCategory: mapping.sourceCategory ? record[mapping.sourceCategory] : undefined,
    index,
  });
}

function makeTransaction(input: {
  sourceId?: string;
  date: string;
  label: string;
  counterparty?: string;
  amount: number;
  sourceRef?: string;
  sourceCategory?: string;
  index: number;
}): NormalizedTransaction {
  const label = input.label?.trim() || `Transaction ${input.index + 1}`;
  const amount = roundMoney(input.amount);
  return {
    sourceId: input.sourceId || undefined,
    date: toIsoDate(input.date),
    label,
    normalizedLabel: normalizeLabel(label),
    counterparty: input.counterparty?.trim() || undefined,
    amount,
    currency: "EUR",
    type: amount < 0 ? "DEBIT" : "CREDIT",
    sourceRef: input.sourceRef || undefined,
    sourceCategory: input.sourceCategory || undefined,
  };
}

export function normalizeLabel(label: string): string {
  return label
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseFrenchAmount(value: string): number {
  const normalized = String(value ?? "")
    .replace(/\s/g, "")
    .replace(",", ".");
  const amount = Number(normalized);
  if (!Number.isFinite(amount)) throw new Error(`Invalid amount: ${value}`);
  return amount;
}

function toIsoDate(value: string): string {
  const clean = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  const match = clean.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  return clean;
}

function extractCounterparty(label: string): string | undefined {
  const normalized = label.replace(/^(PRLV SEPA|CARTE CB|CB|VIR SEPA RECU|VIREMENT RECU|VIR RECU|VIR PERM|CARTE)\s+/i, "");
  return normalized.split(/\s+(REF|FACTURE|0501|0601|\d{4})/i)[0]?.trim() || undefined;
}

function containsAll(columns: string[], expected: string[]) {
  return expected.every((header) => columns.includes(header));
}

function roundMoney(amount: number) {
  return Math.round(amount * 100) / 100;
}

export type BankFormat = "qonto" | "bnp" | "sg" | "boursorama" | "generic";

export type NormalizedTransaction = {
  sourceId?: string;
  date: string;
  label: string;
  normalizedLabel: string;
  counterparty?: string;
  amount: number;
  currency: string;
  type: "DEBIT" | "CREDIT";
  sourceRef?: string;
  sourceCategory?: string;
  notes?: string;
};

export type CsvDetection = {
  format: BankFormat;
  separator: "," | ";";
  columns: string[];
  needsMapping: boolean;
};

export type ColumnMapping = {
  date: string;
  label: string;
  amount: string;
  counterparty?: string;
  sourceId?: string;
  sourceRef?: string;
  sourceCategory?: string;
};

export type ParseCsvInput = {
  content: string;
  mapping?: ColumnMapping;
};

export type ParseCsvResult = {
  detection: CsvDetection;
  rowCount: number;
  transactions: NormalizedTransaction[];
};

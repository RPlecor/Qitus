export type VatRateValue = "none" | "0" | "0.021" | "0.055" | "0.10" | "0.20";

export type VatOperationNatureValue =
  | "DOMESTIC_PURCHASE"
  | "DOMESTIC_SALE"
  | "INTRACOM_PURCHASE"
  | "INTRACOM_SALE"
  | "REVERSE_CHARGE"
  | "EXEMPT"
  | "OUT_OF_SCOPE";

export type VatRateOption = {
  value: VatRateValue;
  label: string;
  rate: number | null;
};

export type VatNatureOption = {
  value: VatOperationNatureValue;
  label: string;
  taxable: boolean;
};

export type VatSelection = {
  vatRate: number | null;
  vatRateValue: VatRateValue;
  vatOperationNature: VatOperationNatureValue | null;
  vatRateLabel: string;
  vatNatureLabel: string;
  errors: string[];
  warnings: string[];
};

export const VAT_RATE_OPTIONS: VatRateOption[] = [
  { value: "none", label: "Aucune TVA", rate: null },
  { value: "0", label: "0 %", rate: 0 },
  { value: "0.021", label: "2,1 %", rate: 0.021 },
  { value: "0.055", label: "5,5 %", rate: 0.055 },
  { value: "0.10", label: "10 %", rate: 0.1 },
  { value: "0.20", label: "20 %", rate: 0.2 },
];

export const VAT_NATURE_OPTIONS: VatNatureOption[] = [
  { value: "DOMESTIC_PURCHASE", label: "Achat France", taxable: true },
  { value: "DOMESTIC_SALE", label: "Vente France", taxable: true },
  { value: "INTRACOM_PURCHASE", label: "Achat intracommunautaire", taxable: true },
  { value: "INTRACOM_SALE", label: "Vente intracommunautaire", taxable: false },
  { value: "REVERSE_CHARGE", label: "Autoliquidation", taxable: true },
  { value: "EXEMPT", label: "Exonéré", taxable: false },
  { value: "OUT_OF_SCOPE", label: "Hors champ", taxable: false },
];

const rateByValue = new Map(VAT_RATE_OPTIONS.map((option) => [option.value, option]));
const natureByValue = new Map(VAT_NATURE_OPTIONS.map((option) => [option.value, option]));

export class VatRatePolicy {
  listRateOptions() {
    return VAT_RATE_OPTIONS;
  }

  listNatureOptions() {
    return VAT_NATURE_OPTIONS;
  }

  parseRate(value: string | number | null | undefined): number | null {
    return parseVatRate(value);
  }

  parseNature(value: string | null | undefined): VatOperationNatureValue | null {
    return parseVatOperationNature(value);
  }

  rateLabel(value: string | number | null | undefined) {
    return vatRateLabel(value);
  }

  natureLabel(value: string | null | undefined) {
    return vatNatureLabel(value);
  }

  validateSelection(input: { vatRate?: string | number | null; vatOperationNature?: string | null }): VatSelection {
    const vatRate = parseVatRate(input.vatRate);
    const vatRateValue = vatRateToOptionValue(vatRate);
    const vatOperationNature = parseVatOperationNature(input.vatOperationNature);
    const nature = vatOperationNature ? natureByValue.get(vatOperationNature) ?? null : null;
    const errors: string[] = [];
    const warnings: string[] = [];

    if (input.vatOperationNature && input.vatOperationNature !== "auto" && !vatOperationNature) {
      errors.push("Nature TVA inconnue.");
    }
    if (input.vatRate !== undefined && input.vatRate !== null && input.vatRate !== "" && vatRate === null && String(input.vatRate) !== "none") {
      errors.push("Taux TVA inconnu.");
    }
    if (nature?.taxable && vatRate === null) {
      errors.push("Un taux TVA est requis pour cette nature taxable.");
    }
    if (!nature?.taxable && nature && vatRate !== null && vatRate > 0) {
      warnings.push("Une nature exonérée ou hors champ ne devrait pas porter un taux TVA positif.");
    }

    return {
      vatRate,
      vatRateValue,
      vatOperationNature,
      vatRateLabel: vatRateLabel(vatRate),
      vatNatureLabel: vatNatureLabel(vatOperationNature),
      errors,
      warnings,
    };
  }
}

export function parseVatRate(value: string | number | null | undefined): number | null {
  if (value === undefined || value === null || value === "" || value === "none") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const option = rateByValue.get(value as VatRateValue);
  if (option) return option.rate;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseVatOperationNature(value: string | null | undefined): VatOperationNatureValue | null {
  if (!value || value === "auto") return null;
  return natureByValue.has(value as VatOperationNatureValue) ? (value as VatOperationNatureValue) : null;
}

export function vatRateToOptionValue(value: string | number | null | undefined): VatRateValue {
  const parsed = parseVatRate(value);
  if (parsed === null) return "none";
  const option = VAT_RATE_OPTIONS.find((candidate) => candidate.rate === parsed);
  return option?.value ?? "none";
}

export function vatRateLabel(value: string | number | null | undefined) {
  const parsed = parseVatRate(value);
  const option = VAT_RATE_OPTIONS.find((candidate) => candidate.rate === parsed);
  return option?.label ?? "Aucune TVA";
}

export function vatNatureLabel(value: string | null | undefined) {
  const parsed = parseVatOperationNature(value);
  if (!parsed) return "Automatique";
  return natureByValue.get(parsed)?.label ?? parsed;
}

export function isTaxableVatNature(value: string | null | undefined) {
  const parsed = parseVatOperationNature(value);
  return parsed ? natureByValue.get(parsed)?.taxable === true : false;
}

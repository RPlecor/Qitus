import { OfficialReferenceCenter } from "./official-reference-center.server";
import type { VatReferencePayload } from "./official-reference-data.server";

export class VatReferenceCenter {
  constructor(private readonly references = new OfficialReferenceCenter()) {}

  getActiveReference() {
    return this.references.getActiveReference<VatReferencePayload>("vat");
  }

  assertReady() {
    this.references.assertReferenceReady("generate_vat_declaration");
  }

  listRateOptions() {
    return this.getActiveReference().payloadJson.rates.map((rate) => ({
      value: rate.value,
      label: rate.label,
      rate: rate.percent === null ? null : rate.percent / 100,
    }));
  }

  listNatureOptions() {
    return this.getActiveReference().payloadJson.natures.map((nature) => ({
      value: nature.value,
      label: nature.label,
    }));
  }

  getVatAccounts() {
    return this.getActiveReference().payloadJson.accounts;
  }

  getRegime(value: string | null | undefined) {
    return this.getActiveReference().payloadJson.regimes.find((regime) => regime.value === value) ?? null;
  }

  validateSelection(input: { rate: string | null | undefined; nature: string | null | undefined }) {
    const payload = this.getActiveReference().payloadJson;
    const rate = payload.rates.find((item) => item.value === input.rate) ?? null;
    const nature = payload.natures.find((item) => item.value === input.nature) ?? null;
    if (!rate || !nature) return { ok: false, reason: "Taux ou nature TVA inconnu dans le référentiel actif." };
    if (!nature.taxable && typeof rate.percent === "number" && rate.percent > 0) {
      return { ok: false, reason: "Une opération exonérée ou hors champ ne peut pas porter un taux TVA positif." };
    }
    return { ok: true, reason: null };
  }
}

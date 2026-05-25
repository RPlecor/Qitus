import { OfficialReferenceCenter } from "./official-reference-center.server";
import type { VatReferencePayload } from "./official-reference-data.server";

export class VatReferenceCenter {
  constructor(private readonly references = new OfficialReferenceCenter()) {}

  async getActiveReference() {
    return this.references.getActiveReferenceAsync<VatReferencePayload>("vat");
  }

  async assertReady() {
    await this.references.assertReferenceReadyAsync("generate_vat_declaration");
  }

  async listRateOptions() {
    const payload = (await this.getActiveReference()).payloadJson;
    return payload.rates.map((rate) => ({
      value: rate.value,
      label: rate.label,
      rate: rate.percent === null ? null : rate.percent / 100,
    }));
  }

  async listNatureOptions() {
    const payload = (await this.getActiveReference()).payloadJson;
    return payload.natures.map((nature) => ({
      value: nature.value,
      label: nature.label,
    }));
  }

  async getVatAccounts() {
    return (await this.getActiveReference()).payloadJson.accounts;
  }

  async getVatAccountCodes() {
    return Object.values(await this.getVatAccounts()) as string[];
  }

  async getVatAccountLabels() {
    return vatAccountLabels(await this.getVatAccounts());
  }

  async getLedgerReference() {
    const accounts = await this.getVatAccounts();
    return { accounts, labels: vatAccountLabels(accounts) };
  }

  async getTolerances() {
    return (await this.getActiveReference()).payloadJson.tolerances;
  }

  async getRegime(value: string | null | undefined) {
    return (await this.getActiveReference()).payloadJson.regimes.find((regime) => regime.value === value) ?? null;
  }

  async validateSelection(input: { rate: string | null | undefined; nature: string | null | undefined }) {
    const payload = (await this.getActiveReference()).payloadJson;
    const rate = payload.rates.find((item) => item.value === input.rate) ?? null;
    const nature = payload.natures.find((item) => item.value === input.nature) ?? null;
    if (!rate || !nature) return { ok: false, reason: "Taux ou nature TVA inconnu dans le référentiel actif." };
    if (!nature.taxable && typeof rate.percent === "number" && rate.percent > 0) {
      return { ok: false, reason: "Une opération exonérée ou hors champ ne peut pas porter un taux TVA positif." };
    }
    return { ok: true, reason: null };
  }
}

export function vatAccountLabels(accounts: VatReferencePayload["accounts"]) {
  return {
    [accounts.deductible]: "TVA déductible",
    [accounts.collected]: "TVA collectée",
    [accounts.reverseCharge]: "TVA intracom/autoliquidation due",
    [accounts.payable]: "TVA à décaisser",
    [accounts.credit]: "Crédit de TVA",
  } as Record<string, string>;
}

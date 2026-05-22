import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { VatRegularizationCenter } from "../vat/vat-regularization-center.server";
import { buildGeneralClosingDraft, type ClosingAdjustmentDraftBuildResult } from "./general-closing-calculators.server";

export class VatSettlementAdjustmentCenter {
  constructor(private readonly vatRegularization = new VatRegularizationCenter()) {}

  async previewSettlementProposal(workspace: CompanyWorkspace): Promise<ClosingAdjustmentDraftBuildResult | null> {
    const balance = await this.vatRegularization.summarizeOpenVatBalance(workspace);
    const amount = Math.abs(balance.net);
    if (amount <= 0) return null;
    const toPay = balance.net >= 0;
    return buildGeneralClosingDraft({
      workpaperKey: `vat-settlement:${workspace.fiscalYear.id}`,
      kind: "VAT_SETTLEMENT",
      title: balance.label,
      assumptions: {
        amount,
        debitAccount: toPay ? "44571" : "44567",
        creditAccount: toPay ? "44551" : "44566",
        basis: "Solde TVA calculé depuis les comptes TVA de l'exercice.",
        requiredEvidence: false,
      },
      calculation: {
        source: "vat-regularization",
        net: balance.net,
        kind: balance.kind,
        accounts: balance.accounts,
      },
    });
  }
}

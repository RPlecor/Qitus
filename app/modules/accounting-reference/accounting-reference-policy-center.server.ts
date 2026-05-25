import { ChartOfAccountsCenter } from "./chart-of-accounts-center.server";
import { OfficialReferenceRuntimeCenter } from "../official-references/official-reference-runtime-center.server";
import type {
  ClosingAdjustmentReferencePayload,
  EInvoiceReferencePayload,
  FixedAssetReferencePayload,
  ReconciliationReferencePayload,
  VatReferencePayload,
} from "../official-references/official-reference-data.server";
import { OfficialReferenceError, type OfficialReferenceCapability } from "../official-references/official-reference-types";

export type AccountingAccountRole =
  | "bank"
  | "bank_fec"
  | "suspense"
  | "supplier"
  | "customer"
  | "payment_in_transit"
  | "prepaid_expense"
  | "deferred_income"
  | "corporate_tax_expense"
  | "corporate_tax_payable"
  | "reconciliation_expense"
  | "reconciliation_income"
  | "fixed_asset_default"
  | "fixed_asset_amortization"
  | "fixed_asset_expense"
  | "vat_deductible"
  | "vat_collected"
  | "vat_payable"
  | "vat_credit"
  | "e_invoice_purchase_review";

export type AccountingAccountRoleValue = {
  role: AccountingAccountRole;
  account: string;
  label: string;
  source: "vat" | "closing_adjustments" | "fixed_assets" | "reconciliation" | "e_invoice";
};

export class AccountingReferencePolicyCenter {
  constructor(
    private readonly references = new OfficialReferenceRuntimeCenter(),
    private readonly chart = new ChartOfAccountsCenter()
  ) {}

  async getAccountRole(role: AccountingAccountRole): Promise<AccountingAccountRoleValue> {
    const value = await this.resolveRole(role);
    if (!value.account) {
      throw new OfficialReferenceError(`Compte référencé introuvable pour le rôle ${role}.`);
    }
    const account = this.chart.getAccount(value.account);
    if (!account) {
      throw new OfficialReferenceError(`Le compte ${value.account} du rôle ${role} est absent du PCG actif.`);
    }
    return { ...value, label: account.label };
  }

  async getAccountRolesForCapability(capability: OfficialReferenceCapability): Promise<AccountingAccountRoleValue[]> {
    const roles = capabilityRoles[capability] ?? [];
    return Promise.all(roles.map((role) => this.getAccountRole(role)));
  }

  async assertAccountRoleReady(role: AccountingAccountRole) {
    await this.getAccountRole(role);
  }

  async validateAccountRole(account: string, role: AccountingAccountRole) {
    const expected = await this.getAccountRole(role);
    return {
      ok: account === expected.account,
      role,
      account,
      expectedAccount: expected.account,
      expectedLabel: expected.label,
    };
  }

  private async resolveRole(role: AccountingAccountRole): Promise<Omit<AccountingAccountRoleValue, "label">> {
    if (role === "bank" || role === "bank_fec" || role === "suspense" || role === "supplier" || role === "customer" || role === "payment_in_transit") {
      const payload = await this.references.getActivePayload<ReconciliationReferencePayload>("reconciliation");
      const roles = payload.accountRoles;
      return {
        role,
        account: role === "bank" ? roles.bank
          : role === "bank_fec" ? roles.bankFec
          : role === "suspense" ? roles.suspense
          : role === "supplier" ? roles.supplier
          : role === "customer" ? roles.customer
          : roles.paymentInTransit,
        source: "reconciliation",
      };
    }
    if (
      role === "prepaid_expense" ||
      role === "deferred_income" ||
      role === "corporate_tax_expense" ||
      role === "corporate_tax_payable" ||
      role === "reconciliation_expense" ||
      role === "reconciliation_income"
    ) {
      const payload = await this.references.getActivePayload<ClosingAdjustmentReferencePayload>("closing_adjustments");
      const roles = payload.accountRoles;
      return {
        role,
        account: role === "prepaid_expense" ? roles.prepaidExpense
          : role === "deferred_income" ? roles.deferredIncome
          : role === "corporate_tax_expense" ? roles.corporateTaxExpense
          : role === "corporate_tax_payable" ? roles.corporateTaxPayable
          : role === "reconciliation_expense" ? roles.reconciliationExpense
          : roles.reconciliationIncome,
        source: "closing_adjustments",
      };
    }
    if (role === "fixed_asset_default" || role === "fixed_asset_amortization" || role === "fixed_asset_expense") {
      const payload = await this.references.getActivePayload<FixedAssetReferencePayload>("fixed_assets");
      const roles = payload.accountRoles;
      return {
        role,
        account: role === "fixed_asset_default" ? roles.defaultAsset
          : role === "fixed_asset_amortization" ? roles.defaultAmortization
          : roles.defaultExpense,
        source: "fixed_assets",
      };
    }
    if (role === "vat_deductible" || role === "vat_collected" || role === "vat_payable" || role === "vat_credit") {
      const payload = await this.references.getActivePayload<VatReferencePayload>("vat");
      const roles = payload.accountRoles;
      return {
        role,
        account: role === "vat_deductible" ? roles.vatDeductible
          : role === "vat_collected" ? roles.vatCollected
          : role === "vat_payable" ? roles.vatPayable
          : roles.vatCredit,
        source: "vat",
      };
    }
    const payload = await this.references.getActivePayload<EInvoiceReferencePayload>("e_invoice");
    return {
      role,
      account: payload.accountRoles.purchaseNeedsReview,
      source: "e_invoice",
    };
  }
}

const capabilityRoles: Record<OfficialReferenceCapability, AccountingAccountRole[]> = {
  categorize_transactions: ["bank", "suspense"],
  generate_vat_declaration: ["vat_deductible", "vat_collected", "vat_payable", "vat_credit"],
  generate_fec: ["bank"],
  generate_tax_package: [],
  approve_closing_adjustment: ["prepaid_expense", "deferred_income", "corporate_tax_expense", "corporate_tax_payable", "reconciliation_expense", "reconciliation_income"],
  calculate_fixed_assets: ["fixed_asset_default", "fixed_asset_amortization", "fixed_asset_expense"],
  prepare_expert_dossier: ["bank", "suspense"],
  process_e_invoice: ["supplier", "e_invoice_purchase_review", "vat_deductible"],
  purge_data: [],
};

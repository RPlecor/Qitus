import { describe, expect, it } from "vitest";
import { qitusVendorMappingDefinitions } from "../app/modules/accounting-rules/vendor-mapping-definitions";
import { ChartOfAccountsCenter } from "../app/modules/accounting-reference/chart-of-accounts-center.server";

describe("ChartOfAccountsCenter", () => {
  it("loads the official PCG artifact with critical Qitus accounts", () => {
    const center = new ChartOfAccountsCenter();
    const integrity = center.validateChartIntegrity();

    expect(integrity).toMatchObject({
      ok: true,
      version: "ANC-PCG-2026-01-01",
      accountCount: 838,
      missingCriticalAccounts: [],
    });
    expect(center.getAccount("5121")).toMatchObject({ label: "Comptes en euros", isPostable: true });
    expect(center.getAccount("44566")).toMatchObject({ label: "TVA sur autres biens et services" });
    expect(center.getAccount("706")).toMatchObject({ label: "Prestations de services" });
  });

  it("covers every account used by active Qitus vendor mappings", () => {
    const center = new ChartOfAccountsCenter();
    const missing = qitusVendorMappingDefinitions.flatMap(([pattern, , accountDebit]) => {
      const accounts = [accountDebit, "5121"];
      return accounts.filter((account) => !center.isPostableAccount(account)).map((account) => `${pattern}:${account}`);
    });

    expect(missing).toEqual([]);
  });
});

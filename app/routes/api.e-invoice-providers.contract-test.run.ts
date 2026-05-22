import { json, type ActionFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { EInvoiceProviderContractTestKit } from "~/modules/e-invoices/e-invoice-provider-contract-test-kit.server";

export async function action(args: ActionFunctionArgs) {
  await requireCompanyWorkspace(args);
  const report = await new EInvoiceProviderContractTestKit().runContractTest();
  return json(report, { status: report.status === "passed" ? 200 : 409 });
}

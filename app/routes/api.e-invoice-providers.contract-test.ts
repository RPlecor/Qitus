import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { EInvoiceProviderContractTestKit } from "~/modules/e-invoices/e-invoice-provider-contract-test-kit.server";

export async function loader(args: LoaderFunctionArgs) {
  await requireCompanyWorkspace(args);
  return json(new EInvoiceProviderContractTestKit().describeContract());
}

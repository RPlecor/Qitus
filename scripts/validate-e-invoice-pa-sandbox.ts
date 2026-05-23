import { getDevCompanyWorkspace } from "../app/modules/company-workspace/company-workspace.server";
import { EInvoiceCenter } from "../app/modules/e-invoices/e-invoice-center.server";
import { AccreditedPlatformSandboxAdapter } from "../app/modules/e-invoices/e-invoice-provider-adapter.server";
import { EInvoiceProviderContractTestKit } from "../app/modules/e-invoices/e-invoice-provider-contract-test-kit.server";
import { EInvoiceSyncWorkflow } from "../app/modules/e-invoices/e-invoice-sync-workflow.server";

async function main() {
  const workspace = await getDevCompanyWorkspace();
  const adapter = new AccreditedPlatformSandboxAdapter();
  const status = await adapter.getStatus();
  check(status.receptionCompliant === false, "La sandbox interne ne doit jamais etre marquee conforme PA reelle.");
  const contract = await new EInvoiceProviderContractTestKit(adapter).runContractTest();
  check(contract.status === "passed", `Contract test attendu passed, obtenu ${contract.status}.`);
  const sync = await new EInvoiceSyncWorkflow(adapter).syncIncomingInvoices(workspace);
  check(sync.status === "COMPLETED", `Sync sandbox attendue COMPLETED, obtenu ${sync.status}.`);
  check(sync.fetchedCount >= 4, "La sandbox doit exposer les cas doublon/rejet/annulation/XML invalide.");
  const invoices = await new EInvoiceCenter().listEInvoices(workspace, {});
  check(invoices.some((invoice) => invoice.invoiceNumber === "SANDBOX-OVH-2025-001"), "Facture sandbox valide attendue.");
  check(invoices.some((invoice) => invoice.providerStatus === "REJECTED" || invoice.providerStatus === "CANCELLED" || invoice.status === "ERROR"), "Cas sandbox de rejet/annulation/erreur attendu.");
  console.log("Validation sandbox PA facture electronique OK");
}

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

export {};

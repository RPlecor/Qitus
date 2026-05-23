import { getDevCompanyWorkspace } from "../app/modules/company-workspace/company-workspace.server";
import { EInvoiceCenter } from "../app/modules/e-invoices/e-invoice-center.server";
import { MockEInvoiceProviderAdapter } from "../app/modules/e-invoices/e-invoice-provider-adapter.server";
import { EInvoiceSyncWorkflow } from "../app/modules/e-invoices/e-invoice-sync-workflow.server";

async function main() {
  const workspace = await getDevCompanyWorkspace();
  const sync = await new EInvoiceSyncWorkflow(new MockEInvoiceProviderAdapter()).syncIncomingInvoices(workspace);
  check(sync.status === "COMPLETED", `Sync attendue COMPLETED, obtenu ${sync.status}.`);
  check(sync.fetchedCount >= 1, "Le provider de test doit fournir au moins une facture.");
  const invoices = await new EInvoiceCenter().listEInvoices(workspace, {});
  check(invoices.some((invoice) => invoice.invoiceNumber === "MOCK-OVH-2025-001"), "Facture de test attendue.");
  console.log("Validation provider facture électronique de test OK");
}

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

export {};

import { getDevCompanyWorkspace } from "../app/modules/company-workspace/company-workspace.server";
import { OpenBankingCenter } from "../app/modules/open-banking/open-banking-center.server";
import { getRuntimeConfig } from "../app/modules/runtime-config.server";

async function main() {
  const workspace = await getDevCompanyWorkspace();
  const center = new OpenBankingCenter({ ...getRuntimeConfig(), openBankingProvider: "mock" });
  await center.createConsent(workspace);
  await center.completeMockConsent(workspace);
  const sync = await center.sync(workspace);
  const status = await center.getStatus(workspace);
  console.log(JSON.stringify({
    provider: status.provider,
    connections: status.connections.length,
    transactionsFetched: sync.transactionsFetched,
    transactionsImported: sync.transactionsImported,
  }, null, 2));
  if (sync.transactionsFetched < 1) throw new Error("Open Banking mock did not fetch transactions.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

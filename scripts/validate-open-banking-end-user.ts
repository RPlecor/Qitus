import { getDevCompanyWorkspace } from "../app/modules/company-workspace/company-workspace.server";
import { prisma } from "../app/modules/db.server";
import { OpenBankingCenter } from "../app/modules/open-banking/open-banking-center.server";
import { OpenBankingSyncWorkflow } from "../app/modules/open-banking/open-banking-sync-workflow.server";
import { OpenBankingWebhookReceiver } from "../app/modules/open-banking/open-banking-webhook-receiver.server";
import { getRuntimeConfig } from "../app/modules/runtime-config.server";

async function main() {
  const workspace = await getDevCompanyWorkspace();
  const config = { ...getRuntimeConfig(), openBankingProvider: "mock" as const };
  const center = new OpenBankingCenter(config);
  await center.createConsent(workspace);
  const connection = await center.completeMockConsent(workspace);
  const firstSync = await new OpenBankingSyncWorkflow(config).syncConnection(workspace, { connectionId: connection.id });
  const secondSync = await new OpenBankingSyncWorkflow(config).syncConnection(workspace, { connectionId: connection.id });
  const detail = await new OpenBankingSyncWorkflow(config).getConnectionDetail(workspace, connection.id);
  const webhookBody = JSON.stringify({ eventId: "validate-ob-end-user", eventType: "connection.active", providerConnectionId: connection.providerConnectionId });
  await prisma.webhookEvent.deleteMany({ where: { eventId: "open_banking:validate-ob-end-user" } });
  const webhook = await new OpenBankingWebhookReceiver(config).verifyAndHandleWebhook(new Request("http://localhost/webhooks/open-banking", { method: "POST", body: webhookBody }));
  const duplicateWebhook = await new OpenBankingWebhookReceiver(config).verifyAndHandleWebhook(new Request("http://localhost/webhooks/open-banking", { method: "POST", body: webhookBody }));

  const result = {
    connection: detail.id,
    firstSync: { fetched: firstSync.transactionsFetched, imported: firstSync.transactionsImported },
    secondSync: { fetched: secondSync.transactionsFetched, imported: secondSync.transactionsImported },
    syncEvents: detail.syncEvents.length,
    webhook,
    duplicateWebhook,
  };
  console.log(JSON.stringify(result, null, 2));
  if (firstSync.transactionsFetched !== 2) throw new Error("Le mock Open Banking doit remonter 2 transactions.");
  if (secondSync.transactionsImported !== 0) throw new Error("La deuxième sync ne doit pas créer de doublons.");
  if (!duplicateWebhook.duplicate) throw new Error("Le webhook Open Banking doit être idempotent.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

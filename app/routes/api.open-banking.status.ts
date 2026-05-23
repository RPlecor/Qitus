import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { OpenBankingCenter } from "~/modules/open-banking/open-banking-center.server";
import { getRuntimeConfig } from "~/modules/runtime-config.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const config = getRuntimeConfig();
  const openBanking = await new OpenBankingCenter(config).getStatus(workspace);
  if (config.qitusInternalTestMode) return json({ openBanking });
  return json({
    openBanking: {
      ...openBanking,
      provider: openBanking.enabled ? "open_banking" : "disabled",
      providerLabel: openBanking.enabled ? "Open Banking" : "Désactivé",
      message: openBanking.configured ? "Provider bancaire configuré." : "Open Banking non configuré.",
      safeMessage: openBanking.configured ? "Provider bancaire configuré." : "Open Banking non configuré.",
      connections: openBanking.connections.map((connection) => ({
        ...connection,
        provider: "Open Banking",
      })),
    },
  });
}

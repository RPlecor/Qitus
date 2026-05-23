import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { ConnectorProductSurfaceCenter } from "~/modules/connectors/connector-product-surface-center.server";
import { ConnectorSyncCenter } from "~/modules/reconciliations/connector-sync-center.server";
import { getRuntimeConfig } from "~/modules/runtime-config.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const config = getRuntimeConfig();
  const product = await new ConnectorProductSurfaceCenter(config).getConnectorOverview(workspace);
  const legacy = new ConnectorSyncCenter(config).getConnectorStatus(workspace);
  const status = config.qitusInternalTestMode ? legacy : {
    mode: product.internalTest.enabled ? "test interne" : "produit",
    connectors: product.cards
      .filter((card) => card.key === "qonto_banking" || card.key === "stripe")
      .map((card) => ({
        provider: card.key === "qonto_banking" ? "qonto" : "stripe",
        enabled: card.state !== "Non configuré",
        configured: card.configured,
        source: card.label,
        message: card.message,
        safeMessage: card.message,
        status: card.state,
      })),
  };
  return json({ status, product });
}

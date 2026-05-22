import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { ConnectorSyncCenter } from "~/modules/reconciliations/connector-sync-center.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const status = new ConnectorSyncCenter().getConnectorStatus(workspace);
  return json({ status });
}

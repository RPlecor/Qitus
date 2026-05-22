import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { ImportOrchestrator } from "~/modules/import-orchestrator/import-orchestrator.server";

export async function loader(args: LoaderFunctionArgs) {
  const { params } = args;
  const workspace = await requireCompanyWorkspace(args);
  const status = await new ImportOrchestrator().getImportStatus(workspace, String(params.id));
  return json(status);
}

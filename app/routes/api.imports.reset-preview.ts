import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { ImportCleanupCenter } from "~/modules/import-orchestrator/import-cleanup-center.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const preview = await new ImportCleanupCenter().previewFiscalYearImportReset(workspace);
  return json({ preview });
}

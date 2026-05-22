import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { ExpertDossierReadinessWorkflow } from "~/modules/expert-dossier/expert-dossier-readiness-workflow.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  return json(await new ExpertDossierReadinessWorkflow().getReadinessQueue(workspace));
}

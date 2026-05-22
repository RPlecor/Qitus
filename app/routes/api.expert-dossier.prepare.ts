import { json, type ActionFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { ExpertDossierReadinessWorkflow } from "~/modules/expert-dossier/expert-dossier-readiness-workflow.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  try {
    return json(await new ExpertDossierReadinessWorkflow().prepareForReview(workspace));
  } catch (error) {
    return jsonOrRedirectError(args.request, error, "/dossier-ec");
  }
}

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { ExpertDossierExportVerifier } from "~/modules/expert-dossier/expert-dossier-export-verifier.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  return json(await new ExpertDossierExportVerifier().getExportVerificationReport(workspace));
}

import { type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { ExpertDossierExportCenter } from "~/modules/expert-dossier/expert-dossier-export-center.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const download = await new ExpertDossierExportCenter().downloadExpertDossier(workspace);
  return new Response(download.body, {
    headers: {
      "content-type": download.contentType,
      "content-disposition": `attachment; filename="${download.filename}"`,
    },
  });
}

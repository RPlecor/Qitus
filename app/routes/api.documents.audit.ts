import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { DocumentCatalog } from "~/modules/documents/document-catalog.server";
import { DocumentGenerationAuditCenter } from "~/modules/documents/document-generation-audit-center.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const [latestGeneration, documents] = await Promise.all([
    new DocumentGenerationAuditCenter().getLatestGenerationAudit(workspace),
    new DocumentCatalog().listDocuments(workspace),
  ]);
  return json({ latestGeneration, documents });
}

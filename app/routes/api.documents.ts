import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { DocumentCatalog } from "~/modules/documents/document-catalog.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const documents = await new DocumentCatalog().listDocuments(workspace);
  return json({ documents });
}

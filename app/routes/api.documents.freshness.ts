import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { DocumentFreshnessCenter } from "~/modules/documents/document-freshness-center.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const freshness = await new DocumentFreshnessCenter().getFreshness(workspace);
  return json({ freshness });
}

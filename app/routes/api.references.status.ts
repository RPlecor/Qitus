import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { OfficialReferenceCenter } from "~/modules/official-references/official-reference-center.server";

export async function loader(args: LoaderFunctionArgs) {
  await requireCompanyWorkspace(args);
  return json(await new OfficialReferenceCenter().getReferenceReadinessAsync());
}

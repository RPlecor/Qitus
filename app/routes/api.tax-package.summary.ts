import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { TaxPackageDraftCenter } from "~/modules/tax-package/tax-package-draft-center.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const summary = await new TaxPackageDraftCenter().getTaxPackageSummary(workspace);
  return json({ summary });
}

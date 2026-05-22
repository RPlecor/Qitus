import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { AnnualClosingCenter } from "~/modules/annual-closing/annual-closing-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const overview = await new AnnualClosingCenter().getClosingOverview(workspace);
  return json({ run: overview.run, steps: overview.steps, canClose: overview.canClose, blockers: overview.blockers, warnings: overview.warnings });
}

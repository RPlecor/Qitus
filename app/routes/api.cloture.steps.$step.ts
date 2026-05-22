import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { AnnualClosingCenter } from "~/modules/annual-closing/annual-closing-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const step = await new AnnualClosingCenter().getStep(workspace, String(args.params.step));
  return json({ step });
}

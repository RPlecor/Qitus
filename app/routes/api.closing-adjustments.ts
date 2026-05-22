import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { ClosingAdjustmentCenter } from "~/modules/closing-adjustments/closing-adjustment-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const proposals = await new ClosingAdjustmentCenter().listProposals(workspace);
  return json({ proposals });
}

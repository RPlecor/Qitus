import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { ClosingAdjustmentCenter } from "~/modules/closing-adjustments/closing-adjustment-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const proposal = await new ClosingAdjustmentCenter().getProposal(workspace, String(args.params.proposalKey));
  return json({ proposal });
}

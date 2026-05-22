import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { ClosingAdjustmentFreshnessCenter } from "~/modules/closing-adjustments/closing-adjustment-freshness-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const freshness = await new ClosingAdjustmentFreshnessCenter().getFreshness(workspace);
  return json({ freshness });
}

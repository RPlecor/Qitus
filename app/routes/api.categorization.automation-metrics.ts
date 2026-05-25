import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { CategorizationAutomationMetricsCenter } from "~/modules/categorization/categorization-automation-metrics-center.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  return json(await new CategorizationAutomationMetricsCenter().getMetrics(workspace));
}

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { UsageMeter } from "~/modules/billing/usage-meter.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  return json(await new UsageMeter().getUsageSummary(workspace));
}

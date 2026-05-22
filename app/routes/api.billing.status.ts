import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { BillingStatusCenter } from "~/modules/billing/billing-status-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  return json(await new BillingStatusCenter().getBillingStatus(workspace));
}

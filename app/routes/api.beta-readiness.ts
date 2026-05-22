import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { BetaReadinessCenter } from "~/modules/deployment/beta-readiness-center.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  return json({ betaReadiness: await new BetaReadinessCenter().getReadiness(workspace) });
}

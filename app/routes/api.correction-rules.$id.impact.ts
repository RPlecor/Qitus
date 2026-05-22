import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { CorrectionRuleImpactCenter } from "~/modules/correction-rules/correction-rule-impact-center.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const impact = await new CorrectionRuleImpactCenter().previewRuleImpact(workspace, String(args.params.id));
  return json({ impact });
}

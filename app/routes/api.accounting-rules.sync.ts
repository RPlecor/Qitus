import { json, type ActionFunctionArgs } from "@remix-run/node";
import { AccountingRulePackCenter } from "~/modules/accounting-rules/accounting-rule-pack-center.server";
import { RegulatorySourceCenter } from "~/modules/accounting-rules/regulatory-source-center.server";
import { RuleApplicationWorkflow } from "~/modules/accounting-rules/rule-application-workflow.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { assertDemoLocalAccess } from "~/modules/demo/demo-local-access.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  try {
    assertDemoLocalAccess();
    const sources = await new RegulatorySourceCenter().syncOfficialSources();
    const pack = await new AccountingRulePackCenter().buildRulePackFromRegulatoryChanges();
    const application = await new RuleApplicationWorkflow().applyActiveRulePackToWorkspace(workspace);
    return json({ sources, pack, application });
  } catch (error) {
    return jsonOrRedirectError(args.request, error, "/regles-comptables");
  }
}

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { AccountingRulePackCenter } from "~/modules/accounting-rules/accounting-rule-pack-center.server";
import { RuleApplicationWorkflow } from "~/modules/accounting-rules/rule-application-workflow.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const [packs, status] = await Promise.all([
    new AccountingRulePackCenter().listRulePacks(),
    new RuleApplicationWorkflow().getRuleUpdateStatus(workspace),
  ]);
  return json({ packs, status });
}

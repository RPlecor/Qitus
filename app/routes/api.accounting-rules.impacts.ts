import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { RuleApplicationWorkflow } from "~/modules/accounting-rules/rule-application-workflow.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const status = await new RuleApplicationWorkflow().getRuleUpdateStatus(workspace);
  return json({ status });
}

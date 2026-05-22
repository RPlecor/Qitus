import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { OpenBankingSyncWorkflow } from "~/modules/open-banking/open-banking-sync-workflow.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  return json({ connection: await new OpenBankingSyncWorkflow().getConnectionDetail(workspace, args.params.id ?? "") });
}

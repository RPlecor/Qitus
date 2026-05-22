import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { AccountingCoverageCenter } from "~/modules/accounting-coverage/accounting-coverage-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  return json({ area: await new AccountingCoverageCenter().getCoverageAreaDetail(workspace, String(args.params.areaCode)) });
}

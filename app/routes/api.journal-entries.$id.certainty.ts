import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { AccountingCertaintyCenter } from "~/modules/accounting-certainty/accounting-certainty-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const certainty = await new AccountingCertaintyCenter().getJournalEntryCertainty(workspace, String(args.params.id));
  return json({ certainty });
}

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { AccountingCertaintyCenter } from "~/modules/accounting-certainty/accounting-certainty-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const center = new AccountingCertaintyCenter();
  const [summary, issues] = await Promise.all([
    center.getFiscalYearCertaintySummary(workspace),
    center.getCertaintyIssues(workspace),
  ]);
  return json({ summary, issues });
}

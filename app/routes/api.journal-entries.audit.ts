import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { JournalAuditCenter } from "~/modules/journal/journal-audit-center.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const audit = await new JournalAuditCenter().getAuditSummary(workspace);
  return json({ audit });
}

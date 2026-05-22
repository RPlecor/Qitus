import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { AuditExportCenter } from "~/modules/activity-log/audit-export-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const center = new AuditExportCenter();
  const [coverage, audit] = await Promise.all([
    center.getAuditCoverage(workspace),
    center.exportAuditJson(workspace, { limit: 1000 }),
  ]);
  return json({ coverage, audit });
}

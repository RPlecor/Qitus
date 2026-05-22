import { type LoaderFunctionArgs } from "@remix-run/node";
import { AuditExportCenter } from "~/modules/activity-log/audit-export-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";

export async function loader(args: LoaderFunctionArgs) {
  const { request } = args;
  const workspace = await requireCompanyWorkspace(args);
  const url = new URL(request.url);
  const csv = await new AuditExportCenter().exportActivityCsv(workspace, {
    type: url.searchParams.get("type"),
    action: url.searchParams.get("action"),
    userId: url.searchParams.get("userId"),
    fiscalYearId: url.searchParams.get("fiscalYearId"),
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
    limit: Number(url.searchParams.get("limit") || 1000),
  });
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"paperasse-activity-log.csv\"",
    },
  });
}

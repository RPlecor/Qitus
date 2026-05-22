import { type LoaderFunctionArgs } from "@remix-run/node";
import { ActivityLogCenter } from "~/modules/activity-log/activity-log-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { DataExportCenter } from "~/modules/privacy/data-export-center.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const exported = await new DataExportCenter().downloadUserExport(workspace);
  await new ActivityLogCenter().recordActivity(workspace, {
    action: "privacy.exported",
    entityType: "privacy",
    entityId: workspace.company.id,
    metadata: { kind: "EXPORT", filename: exported.filename },
  });
  return new Response(exported.content, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exported.filename}"`,
    },
  });
}

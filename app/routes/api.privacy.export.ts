import { type LoaderFunctionArgs } from "@remix-run/node";
import { ActivityLogCenter } from "~/modules/activity-log/activity-log-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { DataExportCenter } from "~/modules/privacy/data-export-center.server";
import { PrivacyCenter } from "~/modules/privacy/privacy-center.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const request = await new PrivacyCenter().requestDataExport(workspace, { format: "json" });
  const exported = await new DataExportCenter().downloadUserExport(workspace);
  await new ActivityLogCenter().recordActivity(workspace, {
    action: "privacy.exported",
    entityType: "privacy",
    entityId: request.id,
    metadata: { kind: "EXPORT", filename: exported.filename, format: "json" },
  });
  return new Response(exported.content, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exported.filename}"`,
    },
  });
}

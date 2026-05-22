import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { ActivityLogCenter } from "~/modules/activity-log/activity-log-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";

export async function loader(args: LoaderFunctionArgs) {
  const { request } = args;
  const workspace = await requireCompanyWorkspace(args);
  const url = new URL(request.url);
  const activity = await new ActivityLogCenter().listActivity(workspace, {
    type: url.searchParams.get("type"),
    action: url.searchParams.get("action"),
    userId: url.searchParams.get("userId"),
    fiscalYearId: url.searchParams.get("fiscalYearId"),
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
    page: Number(url.searchParams.get("page") || 1),
    pageSize: Number(url.searchParams.get("pageSize") || url.searchParams.get("limit") || 100),
  });
  return json({ activity });
}

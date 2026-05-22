import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { ExpertReviewQueue } from "~/modules/expert-dossier/expert-review-queue.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const url = new URL(args.request.url);
  const status = url.searchParams.get("status") || "all";
  const severity = url.searchParams.get("severity");
  const sectionCode = url.searchParams.get("sectionCode");
  return json(await new ExpertReviewQueue().getReviewQueue(workspace, {
    status: status as never,
    severity: severity as never,
    sectionCode,
  }));
}

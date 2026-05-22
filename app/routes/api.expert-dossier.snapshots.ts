import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { DossierSnapshotReviewCenter } from "~/modules/expert-dossier/dossier-snapshot-review-center.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  return json(await new DossierSnapshotReviewCenter().summarizeSnapshotState(workspace));
}

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { VatControlCenter } from "~/modules/vat/vat-control-center.server";
import { VatReviewWorkflow } from "~/modules/vat/vat-review-workflow.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const url = new URL(args.request.url);
  const filters = {
    dateFrom: url.searchParams.get("dateFrom"),
    dateTo: url.searchParams.get("dateTo"),
  };
  const [review, queue] = await Promise.all([
    new VatControlCenter().getVatReview(workspace, filters),
    new VatReviewWorkflow().getReviewQueue(workspace, filters),
  ]);
  return json({ review, queue });
}

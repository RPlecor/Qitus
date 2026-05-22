import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { OpenBankingCenter } from "~/modules/open-banking/open-banking-center.server";
import { ExpectedRouteError, routeErrorMessage } from "~/modules/route-errors.server";

export async function loader(args: LoaderFunctionArgs) {
  try {
    const url = new URL(args.request.url);
    const country = url.searchParams.get("country") ?? "FR";
    const workspace = await requireCompanyWorkspace(args);
    const center = new OpenBankingCenter();
    const status = await center.getStatus(workspace);
    return json({ institutions: await center.listInstitutions({ country }), selectionMode: status.selectionMode });
  } catch (error) {
    return json({ institutions: [], error: routeErrorMessage(error) }, { status: error instanceof ExpectedRouteError ? error.status : 500 });
  }
}

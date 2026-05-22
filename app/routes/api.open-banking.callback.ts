import { redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { OpenBankingCenter } from "~/modules/open-banking/open-banking-center.server";
import { routeErrorMessage } from "~/modules/route-errors.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  try {
    const url = new URL(args.request.url);
    await new OpenBankingCenter().completeConsentCallback(workspace, {
      code: url.searchParams.get("code") ?? url.searchParams.get("session_id"),
      state: url.searchParams.get("state"),
      requisitionId: url.searchParams.get("requisitionId")
        ?? url.searchParams.get("id_connection")
        ?? url.searchParams.get("item_id")
        ?? url.searchParams.get("ref")
        ?? url.searchParams.get("id"),
    });
    return redirect("/connecteurs?openBanking=connected");
  } catch (error) {
    return redirect(`/connecteurs?error=${encodeURIComponent(routeErrorMessage(error))}`);
  }
}

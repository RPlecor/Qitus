import { json, type ActionFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { activeFiscalYearCookie, FiscalYearCenter } from "~/modules/fiscal-years/fiscal-year-center.server";
import { ExpectedRouteError, jsonOrRedirectError } from "~/modules/route-errors.server";

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  try {
    if (!args.params.id) throw new ExpectedRouteError("Exercice manquant.", 400);
    const center = new FiscalYearCenter();
    await center.getFiscalYearSummary(workspace, args.params.id);
    if (args.request.headers.get("accept")?.includes("application/json")) {
      return json({ ok: true }, {
        headers: {
          "Set-Cookie": await activeFiscalYearCookie.serialize(args.params.id),
        },
      });
    }
    return center.activateFiscalYear(args.request, args.params.id);
  } catch (error) {
    return jsonOrRedirectError(args.request, error, "/exercices");
  }
}

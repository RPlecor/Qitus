import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { assertFiscalYearMutable } from "~/modules/annual-closing/annual-closing-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { RateLimitCenter } from "~/modules/deployment/rate-limit-center.server";
import { OpenBankingCenter } from "~/modules/open-banking/open-banking-center.server";
import { ExpectedRouteError, jsonOrRedirectError } from "~/modules/route-errors.server";
import { getRuntimeConfig } from "~/modules/runtime-config.server";

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  try {
    const config = getRuntimeConfig();
    if (!config.qitusInternalTestMode && config.openBankingProvider === "mock") {
      throw new ExpectedRouteError("Connecteur de test interne désactivé sur cette instance.", 403);
    }
    await assertFiscalYearMutable(workspace);
    new RateLimitCenter().assertAllowed({ key: `open-banking:${workspace.company.id}`, limit: 12, windowMs: 60_000, label: "Synchronisation Open Banking" });
    const form = await args.request.formData().catch(() => null);
    const connectionId = typeof form?.get("connectionId") === "string" ? String(form.get("connectionId")) : undefined;
    const result = await new OpenBankingCenter(config).sync(workspace, connectionId);
    if (args.request.headers.get("accept")?.includes("application/json")) return json(result);
    return redirect("/connecteurs?openBanking=synced");
  } catch (error) {
    return jsonOrRedirectError(args.request, error, "/connecteurs");
  }
}

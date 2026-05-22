import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { OpenBankingCenter } from "~/modules/open-banking/open-banking-center.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  try {
    const contentType = args.request.headers.get("content-type") ?? "";
    const input = contentType.includes("application/json")
      ? await args.request.json().catch(() => ({}))
      : Object.fromEntries(await args.request.formData());
    const result = await new OpenBankingCenter().createConsent(workspace, {
      institutionId: typeof input.institutionId === "string" ? input.institutionId : undefined,
      country: typeof input.country === "string" ? input.country : undefined,
    });
    if (args.request.headers.get("accept")?.includes("application/json")) return json({ consent: result });
    return redirect(result.consentUrl);
  } catch (error) {
    return jsonOrRedirectError(args.request, error, "/connecteurs");
  }
}

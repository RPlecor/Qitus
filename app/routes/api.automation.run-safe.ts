import { json, type ActionFunctionArgs } from "@remix-run/node";
import { AutomationOpportunityCenter, type AutomationDomain } from "~/modules/automation/automation-opportunity-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function action(args: ActionFunctionArgs) {
  const { request } = args;
  const workspace = await requireCompanyWorkspace(args);
  try {
    const form = await request.formData();
    const domain = parseDomain(stringValue(form.get("domain")));
    const opportunityKeys = form.getAll("opportunityKey").map(stringValue).filter(Boolean);
    const result = await new AutomationOpportunityCenter().runSafeAutomations(workspace, {
      domain,
      opportunityKeys: opportunityKeys.length > 0 ? opportunityKeys : undefined,
    });
    return json(result);
  } catch (error) {
    return jsonOrRedirectError(request, error, "/dashboard");
  }
}

function parseDomain(value: string | null): AutomationDomain | null {
  const allowed: AutomationDomain[] = ["imports", "transactions", "attachments", "tva", "reconciliations", "documents", "expert_dossier", "notifications", "e_invoices", "closing"];
  return allowed.includes(value as AutomationDomain) ? value as AutomationDomain : null;
}

function stringValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

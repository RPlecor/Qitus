import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { AutomationOpportunityCenter, summarizeAutomationOpportunities, type AutomationCategory, type AutomationDomain } from "~/modules/automation/automation-opportunity-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";
import { getRuntimeConfig } from "~/modules/runtime-config.server";

export async function loader(args: LoaderFunctionArgs) {
  const { request } = args;
  const workspace = await requireCompanyWorkspace(args);
  try {
    const url = new URL(request.url);
    const domain = parseDomain(url.searchParams.get("domain"));
    const category = parseCategory(url.searchParams.get("category"));
    const limit = parseLimit(url.searchParams.get("limit"));
    const center = new AutomationOpportunityCenter();
    const allOpportunities = await center.getOpportunities(workspace, { domain, category });
    const opportunities = limit ? allOpportunities.slice(0, limit) : allOpportunities;
    return json({
      opportunities,
      summary: summarizeAutomationOpportunities(getRuntimeConfig().automationMode, allOpportunities),
    });
  } catch (error) {
    return jsonOrRedirectError(request, error, "/dashboard");
  }
}

function parseDomain(value: string | null): AutomationDomain | null {
  const allowed: AutomationDomain[] = ["imports", "transactions", "attachments", "tva", "reconciliations", "documents", "expert_dossier", "notifications", "e_invoices", "closing"];
  return allowed.includes(value as AutomationDomain) ? value as AutomationDomain : null;
}

function parseCategory(value: string | null): AutomationCategory | null {
  if (value === "1" || value === "2" || value === "3") return Number(value) as AutomationCategory;
  return null;
}

function parseLimit(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), 100) : null;
}

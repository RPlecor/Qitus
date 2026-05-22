import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { ActivityLogCenter } from "~/modules/activity-log/activity-log-center.server";
import { CompanyProfile, companyProfileInputFromForm } from "~/modules/company-workspace/company-profile.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";

export async function action(args: ActionFunctionArgs) {
  const { request } = args;
  const form = await request.formData();
  const workspace = await requireCompanyWorkspace(args);

  const company = await new CompanyProfile().completeOnboarding(workspace, companyProfileInputFromForm(form));
  await new ActivityLogCenter().recordActivity(workspace, {
    action: "profile.onboarding_completed",
    entityType: "company",
    entityId: company.id,
    metadata: { name: company.name },
  });

  if (request.headers.get("accept")?.includes("application/json")) return json(company);
  return redirect("/dashboard");
}

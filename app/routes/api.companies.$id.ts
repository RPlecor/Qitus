import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { ActivityLogCenter } from "~/modules/activity-log/activity-log-center.server";
import { CompanyProfile, companyProfileInputFromForm } from "~/modules/company-workspace/company-profile.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  return json(await new CompanyProfile().getProfile(workspace));
}

export async function action(args: ActionFunctionArgs) {
  const { request } = args;
  const workspace = await requireCompanyWorkspace(args);
  const form = await request.formData();
  const updated = await new CompanyProfile().saveProfile(workspace, companyProfileInputFromForm(form));
  await new ActivityLogCenter().recordActivity(workspace, {
    action: "profile.updated",
    entityType: "company",
    entityId: updated.id,
    metadata: { name: updated.name },
  });
  if (request.headers.get("accept")?.includes("application/json")) return json(updated);
  return redirect("/profil");
}

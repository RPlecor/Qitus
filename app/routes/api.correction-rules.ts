import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { CorrectionRuleCenter } from "~/modules/correction-rules/correction-rule-center.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const url = new URL(args.request.url);
  const activeParam = url.searchParams.get("active");
  const active = activeParam === "true" ? true : activeParam === "false" ? false : null;
  const rules = await new CorrectionRuleCenter().listRules(workspace, {
    active,
    search: url.searchParams.get("search"),
  });
  return json({ rules });
}

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const form = await args.request.formData();
  try {
    const rule = await new CorrectionRuleCenter().createRule(workspace, {
      counterparty: String(form.get("counterparty") || ""),
      preferredAccount: String(form.get("preferredAccount") || "471"),
      preferredAccountLabel: String(form.get("preferredAccountLabel") || "") || null,
      condition: String(form.get("condition") || "") || null,
      note: String(form.get("note") || "") || null,
    });
    if (!args.request.headers.get("accept")?.includes("application/json")) return redirect("/corrections");
    return json({ rule });
  } catch (error) {
    return jsonOrRedirectError(args.request, error, "/corrections");
  }
}

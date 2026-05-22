import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { CorrectionRuleCenter } from "~/modules/correction-rules/correction-rule-center.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const impact = await new CorrectionRuleCenter().previewRuleImpact(workspace, String(args.params.id));
  return json({ impact });
}

export async function action(args: ActionFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const form = await args.request.formData();
  const intent = String(form.get("intent") || "");
  const redirectTo = safeCorrectionRedirect(String(form.get("redirectTo") || "/corrections"));
  const center = new CorrectionRuleCenter();
  try {
    let payload: unknown;
    if (intent === "disable") payload = { rule: await center.updateRule(workspace, String(args.params.id), { active: false }) };
    else if (intent === "enable") payload = { rule: await center.updateRule(workspace, String(args.params.id), { active: true }) };
    else if (intent === "delete") payload = await center.deleteRule(workspace, String(args.params.id));
    else payload = {
      rule: await center.updateRule(workspace, String(args.params.id), {
        counterparty: String(form.get("counterparty") || ""),
        preferredAccount: String(form.get("preferredAccount") || ""),
        preferredAccountLabel: String(form.get("preferredAccountLabel") || "") || null,
        condition: String(form.get("condition") || "") || null,
        note: String(form.get("note") || "") || null,
      }),
    };
    if (!args.request.headers.get("accept")?.includes("application/json")) return redirect(redirectTo);
    return json(payload);
  } catch (error) {
    return jsonOrRedirectError(args.request, error, redirectTo);
  }
}

function safeCorrectionRedirect(value: string) {
  return value.startsWith("/corrections") ? value : "/corrections";
}

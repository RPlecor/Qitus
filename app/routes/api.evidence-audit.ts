import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { EvidenceAuditCenter } from "~/modules/evidence/evidence-audit-center.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const audit = await new EvidenceAuditCenter().getEvidenceAudit(workspace);
  return json({ audit });
}

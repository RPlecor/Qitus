import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { EvidenceRequirementCenter } from "~/modules/accounting-coverage/evidence-requirement-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const center = new EvidenceRequirementCenter();
  const [requirements, summary] = await Promise.all([
    center.listEvidenceRequirements(workspace),
    center.summarizeEvidenceGaps(workspace),
  ]);
  return json({ policy: center.getEvidencePolicy(), summary, requirements });
}

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { EvidenceRequirementCenter, type EvidenceRequirementKind, type EvidenceRequirementLevel } from "~/modules/accounting-coverage/evidence-requirement-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const url = new URL(args.request.url);
  const missing = await new EvidenceRequirementCenter().listMissingEvidence(workspace, {
    level: parseLevel(url.searchParams.get("level")),
    kind: parseKind(url.searchParams.get("kind")),
  });
  return json({ missing });
}

function parseLevel(value: string | null): EvidenceRequirementLevel | null {
  return value === "required" || value === "recommended" || value === "not_applicable" ? value : null;
}

function parseKind(value: string | null): EvidenceRequirementKind | null {
  const allowed = ["invoice", "receipt", "bank_statement", "contract", "user_decision", "expert_validation"];
  return allowed.includes(value ?? "") ? value as EvidenceRequirementKind : null;
}

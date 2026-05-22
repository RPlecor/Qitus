import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { ReconciliationReviewWorkflow } from "../reconciliations/reconciliation-review-workflow.server";
import { buildGeneralClosingDraft, type ClosingAdjustmentDraftBuildResult } from "./general-closing-calculators.server";

export class ReconciliationAdjustmentCenter {
  constructor(private readonly reconciliationReview = new ReconciliationReviewWorkflow()) {}

  async listAdjustmentDrafts(workspace: CompanyWorkspace): Promise<ClosingAdjustmentDraftBuildResult[]> {
    const queue = await this.reconciliationReview.getReviewQueue(workspace, { status: "OPEN" });
    const drafts: ClosingAdjustmentDraftBuildResult[] = [];
    for (const issue of queue.issues) {
      if (!["DIFFERENCE", "SUSPENSE_ACCOUNT_OPEN", "BANK_UNMATCHED_LEDGER_LINE"].some((code) => issue.code.startsWith(code))) continue;
      const detail = await this.reconciliationReview.getIssueDetail(workspace, issue.issueKey).catch(() => null);
      const amount = Math.abs(extractAmount(detail?.entity));
      if (amount <= 0) continue;
      const draft = buildGeneralClosingDraft({
        workpaperKey: `reconciliation:${issue.issueKey}`,
        kind: "RECONCILIATION_DIFFERENCE",
        title: `Écart rapprochement - ${issue.code}`,
        assumptions: {
          amount,
          debitAccount: amount > 0 ? "658" : "471",
          creditAccount: amount > 0 ? "471" : "758",
          basis: issue.note ?? "Écart issu du rapprochement ligne à ligne.",
          requiredEvidence: true,
        },
        calculation: {
          source: "reconciliation-issue",
          code: issue.code,
          amount,
        },
        sourceEntityType: "reconciliation_issue",
        sourceEntityId: issue.id,
      });
      if (draft) drafts.push(draft);
    }
    return drafts;
  }
}

function extractAmount(entity: unknown) {
  if (!entity || typeof entity !== "object") return 0;
  const record = entity as Record<string, unknown>;
  for (const key of ["amount", "debit", "credit", "netAmount", "grossAmount"]) {
    const value = record[key];
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    if (value && typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") {
      return Number(value.toNumber());
    }
  }
  return 0;
}

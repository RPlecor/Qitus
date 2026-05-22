import { describe, expect, it } from "vitest";
import { buildEvidenceReviewQueue, linkTargetForRequirement } from "../app/modules/evidence/evidence-review-workflow.server";

describe("EvidenceReviewWorkflow", () => {
  it("separates missing required, recommended and satisfied requirements", () => {
    const queue = buildEvidenceReviewQueue([
      requirement({ id: "req_invoice", kind: "invoice", level: "required", missing: true }),
      requirement({ id: "req_contract", kind: "contract", level: "recommended", missing: true }),
      requirement({ id: "req_receipt", kind: "receipt", level: "required", missing: false }),
    ]);

    expect(queue.required).toHaveLength(1);
    expect(queue.recommended).toHaveLength(1);
    expect(queue.satisfied).toHaveLength(1);
    expect(queue.summary.active).toBe(2);
  });

  it("builds an unambiguous link target from a requirement", () => {
    expect(linkTargetForRequirement(requirement({
      entityType: "transaction",
      entityId: "txn_1",
      kind: "invoice",
    }))).toEqual({
      entityType: "TRANSACTION",
      entityId: "txn_1",
      relationType: "INVOICE",
    });
  });
});

function requirement(overrides: Partial<{
  id: string;
  entityType: "journal_entry" | "transaction" | "closing_adjustment" | "fiscal_year";
  entityId: string;
  label: string;
  kind: "invoice" | "receipt" | "bank_statement" | "contract" | "user_decision" | "expert_validation";
  level: "required" | "recommended" | "not_applicable";
  missing: boolean;
  href: string;
}> = {}) {
  return {
    id: "req",
    entityType: "journal_entry" as const,
    entityId: "entry_1",
    label: "Justificatif",
    kind: "receipt" as const,
    level: "required" as const,
    missing: true,
    href: "/ecritures",
    ...overrides,
  };
}

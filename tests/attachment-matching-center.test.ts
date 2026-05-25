import { describe, expect, it } from "vitest";
import { relationTypeForEvidenceKind, scoreAttachmentMatch } from "../app/modules/evidence/attachment-matching-center.server";

describe("AttachmentMatchingCenter", () => {
  it("scores exact amount, close date and supplier match", () => {
    const result = scoreAttachmentMatch(
      { supplierName: "OVH SAS", invoiceDate: new Date("2025-01-03"), amountTtc: decimal(29.99) },
      { kind: "invoice", label: "Facture OVH" },
      { requirementId: "req_1", text: "OVH SAS OVH CLOUD HOSTING JANVIER", amount: -29.99, date: new Date("2025-01-03") },
      0.01,
    );

    expect(result.score).toBeGreaterThanOrEqual(100);
    expect(result.reasons).toContain("montant exact");
    expect(result.reasons).toContain("fournisseur reconnu");
  });

  it("maps evidence kinds to attachment relation types", () => {
    expect(relationTypeForEvidenceKind("contract")).toBe("CONTRACT");
    expect(relationTypeForEvidenceKind("user_decision")).toBe("USER_DECISION");
  });
});

function decimal(value: number) {
  return { toNumber: () => value };
}

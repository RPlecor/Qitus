import { describe, expect, it } from "vitest";
import { flattenTrackableIssues, summarizeIssues } from "../app/modules/accounting-issues/accounting-issue-tracker.server";

describe("AccountingIssueTracker", () => {
  it("flattens controls into stable trackable issues", () => {
    const issues = flattenTrackableIssues([{
      code: "ANNUAL_CHARGE_CCA",
      severity: "warning",
      category: "pre_closing",
      title: "Charges annuelles à revoir en CCA",
      detail: "Certaines charges annuelles peuvent couvrir une période hors exercice.",
      action: { label: "Traiter les CCA", href: "/controle/ANNUAL_CHARGE_CCA" },
      openIssueCount: 1,
      handledIssueCount: 1,
      evidence: [
        { issueKey: "ANNUAL_CHARGE_CCA:transaction:txn_1", label: "AXA", resolutionStatus: "RESOLVED", note: "Revu" },
        { issueKey: "ANNUAL_CHARGE_CCA:transaction:txn_2", label: "CANVA" },
      ],
    }]);

    expect(issues.map((issue) => issue.issueKey)).toEqual([
      "ANNUAL_CHARGE_CCA:transaction:txn_1",
      "ANNUAL_CHARGE_CCA:transaction:txn_2",
    ]);
    expect(issues[0]).toMatchObject({ status: "RESOLVED", note: "Revu" });
    expect(issues[1]).toMatchObject({ status: "OPEN", note: null });
  });

  it("summarizes open, resolved and ignored issues", () => {
    expect(summarizeIssues([
      issue("OPEN"),
      issue("RESOLVED"),
      issue("IGNORED"),
      issue("OPEN"),
    ])).toEqual({ open: 2, resolved: 1, ignored: 1 });
  });
});

function issue(status: "OPEN" | "RESOLVED" | "IGNORED") {
  return {
    issueKey: `key-${status}-${Math.random()}`,
    controlCode: "VAT_THRESHOLD",
    controlTitle: "Seuil TVA",
    controlDetail: "À surveiller",
    severity: "warning" as const,
    category: "tax",
    status,
    note: null,
    evidence: {},
    action: { label: "Traiter", href: "/controle/VAT_THRESHOLD" },
  };
}

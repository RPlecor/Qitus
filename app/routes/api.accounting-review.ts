import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { AccountingIssueTracker } from "~/modules/accounting-issues/accounting-issue-tracker.server";
import { AccountingReviewCenter } from "~/modules/accounting-review/accounting-review-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const review = await new AccountingReviewCenter().getReview(workspace);
  const issueState = await new AccountingIssueTracker().summarizeIssueState(workspace);
  return json({ review, issueState });
}

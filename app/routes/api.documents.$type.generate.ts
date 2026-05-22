import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { ActivityLogCenter } from "~/modules/activity-log/activity-log-center.server";
import { AccountingIssueTracker } from "~/modules/accounting-issues/accounting-issue-tracker.server";
import { AccountingReviewCenter, DocumentGenerationBlockedError } from "~/modules/accounting-review/accounting-review-center.server";
import { assertFiscalYearMutable } from "~/modules/annual-closing/annual-closing-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { qitusDocumentErrorMessage, type DocumentGenerationType } from "~/modules/documents/document-center.server";
import { DocumentGenerationAuditCenter } from "~/modules/documents/document-generation-audit-center.server";
import { DocumentGenerationCenter } from "~/modules/documents/document-generation-center.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";
import { TaxPackageDraftCenter } from "~/modules/tax-package/tax-package-draft-center.server";

export async function action(args: ActionFunctionArgs) {
  const { request, params } = args;
  const workspace = await requireCompanyWorkspace(args);
  const type: DocumentGenerationType = params.type === "statements" ? "statements" : params.type === "liasse" ? "liasse" : "fec";
  const activity = new ActivityLogCenter();
  const audit = new DocumentGenerationAuditCenter();
  const startedAt = new Date().toISOString();

  try {
    await assertFiscalYearMutable(workspace);
    await audit.recordGenerationAttempt(workspace, { types: [type], startedAt });
    const documents = type === "liasse"
      ? (await new TaxPackageDraftCenter().generateTaxPackageDraft(workspace)).documents
      : await new DocumentGenerationCenter().generateDocuments(workspace, { types: [type] });
    await audit.recordGenerationSuccess(workspace, { types: [type], documents, startedAt });
    const review = await new AccountingReviewCenter().getReview(workspace);
    const issueState = await new AccountingIssueTracker().summarizeIssueState(workspace);
    await activity.recordActivity(workspace, {
      action: review.warningCount > 0 ? "document.generated_with_warnings" : "document.generated",
      entityType: "document",
      entityId: documents.map((document) => document.id).join(","),
      metadata: { type, filenames: documents.map((document) => document.filename), warningCount: review.warningCount, openIssues: issueState.open },
    });

    if (request.headers.get("accept")?.includes("application/json")) return json({ documents });
    return redirect("/documents");
  } catch (error) {
    const message = qitusDocumentErrorMessage(error);
    await audit.recordGenerationFailure(workspace, { types: [type], startedAt, userMessage: message });
    if (error instanceof DocumentGenerationBlockedError) {
      await activity.recordActivity(workspace, {
        action: "document.blocked",
        entityType: "document",
        metadata: { type, message, blockingCount: error.review.blockingCount },
      });
      return jsonOrRedirectError(request, error, "/documents");
    }
    await activity.recordActivity(workspace, {
      action: "document.failed",
      entityType: "document",
      metadata: { type, message },
    });
    return jsonOrRedirectError(request, error, "/documents");
  }
}

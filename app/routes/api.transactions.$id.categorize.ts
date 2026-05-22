import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { ActivityLogCenter } from "~/modules/activity-log/activity-log-center.server";
import { AccountingReviewCenter } from "~/modules/accounting-review/accounting-review-center.server";
import { assertFiscalYearMutable } from "~/modules/annual-closing/annual-closing-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { CorrectionRuleCenter } from "~/modules/correction-rules/correction-rule-center.server";
import { TransactionCorrectionFlow } from "~/modules/transactions/transaction-correction-flow.server";
import { TransactionFilterStateCenter } from "~/modules/transactions/transaction-filter-state";
import { TransactionReviewQueue } from "~/modules/transactions/transaction-review-queue.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";
import { parseVatOperationNature, vatRateToOptionValue } from "~/modules/vat/vat-rate-policy";

export async function action(args: ActionFunctionArgs) {
  const { request, params } = args;
  const workspace = await requireCompanyWorkspace(args);
  try {
  await assertFiscalYearMutable(workspace);
  const reviewCenter = new AccountingReviewCenter();
  const reviewBefore = await reviewCenter.getReview(workspace);
  const filters = new TransactionFilterStateCenter();
  const filterState = filters.parseFromUrl(new URL(request.url));
  const queue = new TransactionReviewQueue();
  const nextReview = await queue.getNextReview(workspace, String(params.id), filterState);
  const form = await request.formData();
  const result = await new TransactionCorrectionFlow().confirmCategorization({
    transactionId: String(params.id),
    accountDebit: String(form.get("accountDebit") || "471"),
    accountCredit: String(form.get("accountCredit") || "5121"),
    vatRate: normalizeVatRate(form.get("vatRate")),
    vatOperationNature: normalizeVatOperationNature(form.get("vatOperationNature")),
    ecritureLabel: String(form.get("ecritureLabel") || "Transaction corrigée"),
    learn: Boolean(form.get("learn")),
  });
  if (Boolean(form.get("learn"))) {
    const amount = Number(result.categorization.accountDebit === "5121" ? 1 : -1);
    await new CorrectionRuleCenter().createRuleFromTransaction(workspace, {
      transactionId: String(params.id),
      preferredAccount: amount >= 0 ? result.categorization.accountCredit ?? "471" : result.categorization.accountDebit ?? "471",
      preferredAccountLabel: amount >= 0 ? result.categorization.accountCreditLabel : result.categorization.accountDebitLabel,
      preferredVatRate: result.categorization.vatRate?.toString() ?? null,
      vatOperationNature: result.categorization.vatOperationNature,
      note: "Créée depuis une correction transaction.",
    });
  }
  await new ActivityLogCenter().recordActivity(workspace, {
    action: "transaction.categorized",
    entityType: "transaction",
    entityId: String(params.id),
    metadata: { accountDebit: result.categorization.accountDebit, accountCredit: result.categorization.accountCredit, vatRate: result.categorization.vatRate, vatOperationNature: result.categorization.vatOperationNature },
  });
  const reviewAfter = await reviewCenter.getReview(workspace);
  if (reviewAfter.blockingCount < reviewBefore.blockingCount) {
    await new ActivityLogCenter().recordActivity(workspace, {
      action: "accounting_review.blocker_resolved",
      entityType: "transaction",
      entityId: String(params.id),
      metadata: { before: reviewBefore.blockingCount, after: reviewAfter.blockingCount },
    });
  }

  if (request.headers.get("accept")?.includes("application/json")) return json(result);
  if (nextReview) return redirect(queue.detailUrl(nextReview.id, filterState));
  return redirect(`/transactions?${filters.toUrlParams(filterState, { status: "review", page: 1 }).toString()}`);
  } catch (error) {
    return jsonOrRedirectError(request, error, "/transactions");
  }
}

function normalizeVatRate(value: FormDataEntryValue | null) {
  if (value === null) return null;
  const normalized = vatRateToOptionValue(String(value));
  return normalized === "none" ? null : normalized;
}

function normalizeVatOperationNature(value: FormDataEntryValue | null) {
  if (value === null) return null;
  return parseVatOperationNature(String(value));
}

export type TransactionReviewCategorization = {
  status?: string | null;
  confidence?: string | null;
} | null;

export function isTransactionInReview(categorization: TransactionReviewCategorization) {
  return !categorization || categorization.status === "NEEDS_REVIEW";
}

import { describe, expect, it } from "vitest";
import { isTransactionInReview } from "../app/modules/transactions/transaction-review-state";

describe("TransactionReviewState", () => {
  it("uses Categorization.status as the product review invariant", () => {
    expect(isTransactionInReview(null)).toBe(true);
    expect(isTransactionInReview({ status: "NEEDS_REVIEW", confidence: "HIGH" })).toBe(true);
    expect(isTransactionInReview({ status: "PROPOSED", confidence: "LOW" })).toBe(false);
    expect(isTransactionInReview({ status: "USER_CONFIRMED", confidence: "HIGH" })).toBe(false);
  });
});

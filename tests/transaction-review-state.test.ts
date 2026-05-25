import { describe, expect, it } from "vitest";
import { isTransactionInLightReview, isTransactionInReview } from "../app/modules/transactions/transaction-review-state";

describe("TransactionReviewState", () => {
  it("uses Categorization.status as the product review invariant", () => {
    expect(isTransactionInReview(null)).toBe(true);
    expect(isTransactionInReview({ status: "NEEDS_REVIEW", confidence: "HIGH" })).toBe(true);
    expect(isTransactionInReview({ status: "PROPOSED", confidence: "LOW" })).toBe(false);
    expect(isTransactionInReview({ status: "REVIEW_LIGHT", confidence: "HIGH" })).toBe(false);
    expect(isTransactionInReview({ status: "USER_CONFIRMED", confidence: "HIGH" })).toBe(false);
  });

  it("separates light review from hard review", () => {
    expect(isTransactionInLightReview({ status: "REVIEW_LIGHT", confidence: "HIGH" })).toBe(true);
    expect(isTransactionInLightReview({ status: "NEEDS_REVIEW", confidence: "HIGH" })).toBe(false);
  });
});

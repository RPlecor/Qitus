import { describe, expect, it } from "vitest";
import { TransactionReviewQueue } from "../app/modules/transactions/transaction-review-queue.server";
import { TransactionFilterStateCenter } from "../app/modules/transactions/transaction-filter-state";
import type { TransactionListItem } from "../app/modules/transactions/transaction-explorer.server";

describe("TransactionReviewQueue", () => {
  it("returns current, next and previous review transactions inside the filtered queue", async () => {
    const explorer = {
      async listTransactions() {
        return {
          transactions: [reviewTransaction("tx_1"), reviewTransaction("tx_2"), reviewTransaction("tx_3")],
        };
      },
    };
    const queue = new TransactionReviewQueue(explorer as never);
    const filters = new TransactionFilterStateCenter().normalize({ status: "review", search: "depot" });
    const navigation = await queue.getCurrentReview({} as never, "tx_2", filters);

    expect(navigation.total).toBe(3);
    expect(navigation.position).toBe(2);
    expect(navigation.previous?.id).toBe("tx_1");
    expect(navigation.next?.id).toBe("tx_3");
    expect(navigation.nextUrl).toContain("/transactions/tx_3?");
  });

  it("summarizes an empty review queue with a user-facing message", async () => {
    const explorer = { async listTransactions() { return { transactions: [] }; } };
    const queue = new TransactionReviewQueue(explorer as never);
    await expect(queue.summarizeQueue({} as never, new TransactionFilterStateCenter().getDefaultState())).resolves.toEqual({
      total: 0,
      empty: true,
      emptyMessage: "Aucune transaction à corriger",
    });
  });
});

function reviewTransaction(id: string): TransactionListItem {
  return {
    id,
    date: "2025-03-31T00:00:00.000Z",
    label: id,
    counterparty: null,
    amount: "-10",
    direction: "debit",
    account: "471",
    confidence: null,
    categorizationStatus: "NEEDS_REVIEW",
    businessStatus: "NEEDS_REVIEW",
    needsReview: true,
    needsLightReview: false,
    autoApplied: false,
    hasRule: false,
    journalEntryId: null,
  };
}

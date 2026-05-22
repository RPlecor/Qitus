import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { TransactionExplorer, type TransactionListItem } from "./transaction-explorer.server";
import { TransactionFilterStateCenter, type TransactionFilterState } from "./transaction-filter-state";

export type TransactionReviewNavigation = {
  total: number;
  position: number | null;
  previous: TransactionListItem | null;
  next: TransactionListItem | null;
  listUrl: string;
  previousUrl: string | null;
  nextUrl: string | null;
  emptyMessage: string;
};

export class TransactionReviewQueue {
  constructor(
    private readonly explorer = new TransactionExplorer(),
    private readonly filters = new TransactionFilterStateCenter()
  ) {}

  async getQueue(workspace: CompanyWorkspace, filterState: TransactionFilterState) {
    const result = await this.explorer.listTransactions(workspace, this.filters.toExplorerQuery({
      ...filterState,
      page: 1,
      pageSize: 100,
      status: "review",
    }));
    return result.transactions;
  }

  async getCurrentReview(workspace: CompanyWorkspace, transactionId: string, filterState: TransactionFilterState): Promise<TransactionReviewNavigation> {
    const queue = await this.getQueue(workspace, filterState);
    const index = queue.findIndex((transaction) => transaction.id === transactionId);
    const previous = index > 0 ? queue[index - 1] : null;
    const next = index >= 0 && index < queue.length - 1 ? queue[index + 1] : null;
    const listUrl = `/transactions?${this.filters.toUrlParams(filterState).toString()}`;
    return {
      total: queue.length,
      position: index >= 0 ? index + 1 : null,
      previous,
      next,
      listUrl,
      previousUrl: previous ? this.detailUrl(previous.id, filterState) : null,
      nextUrl: next ? this.detailUrl(next.id, filterState) : null,
      emptyMessage: "Aucune transaction à corriger",
    };
  }

  async getNextReview(workspace: CompanyWorkspace, transactionId: string, filterState: TransactionFilterState) {
    return (await this.getCurrentReview(workspace, transactionId, filterState)).next;
  }

  async getPreviousReview(workspace: CompanyWorkspace, transactionId: string, filterState: TransactionFilterState) {
    return (await this.getCurrentReview(workspace, transactionId, filterState)).previous;
  }

  async summarizeQueue(workspace: CompanyWorkspace, filterState: TransactionFilterState) {
    const queue = await this.getQueue(workspace, filterState);
    return {
      total: queue.length,
      empty: queue.length === 0,
      emptyMessage: "Aucune transaction à corriger",
    };
  }

  detailUrl(transactionId: string, filterState: TransactionFilterState) {
    return `/transactions/${transactionId}?${this.filters.toUrlParams(filterState, { status: "review", page: 1 }).toString()}`;
  }
}

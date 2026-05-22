import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { TransactionExplorer } from "~/modules/transactions/transaction-explorer.server";
import { TransactionFilterStateCenter } from "~/modules/transactions/transaction-filter-state";
import { TransactionReviewQueue } from "~/modules/transactions/transaction-review-queue.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const url = new URL(args.request.url);
  const filters = new TransactionFilterStateCenter();
  const filterState = filters.parseFromUrl(url);
  const [result, queueSummary] = await Promise.all([
    new TransactionExplorer().listTransactions(workspace, filters.toExplorerQuery(filterState)),
    new TransactionReviewQueue().summarizeQueue(workspace, filterState),
  ]);
  return json({
    ...result,
    filterState,
    activeFilterLabels: filters.describeActiveFilters(filterState),
    queueSummary,
  });
}

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { TransactionExplorer } from "~/modules/transactions/transaction-explorer.server";
import { TransactionFilterStateCenter } from "~/modules/transactions/transaction-filter-state";
import { TransactionReviewQueue } from "~/modules/transactions/transaction-review-queue.server";
import { TransactionSuggestionCenter } from "~/modules/transactions/transaction-suggestion-center.server";

export async function loader(args: LoaderFunctionArgs) {
  const { params, request } = args;
  const workspace = await requireCompanyWorkspace(args);
  const filterState = new TransactionFilterStateCenter().parseFromUrl(new URL(request.url));
  const transaction = await new TransactionExplorer().getTransactionDetail(workspace, String(params.id));
  const suggestions = await new TransactionSuggestionCenter().getSuggestions(workspace, String(params.id));
  const navigation = await new TransactionReviewQueue().getCurrentReview(workspace, String(params.id), filterState);
  return json({ transaction, suggestions, navigation });
}

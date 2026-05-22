import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { JournalExplorer, type JournalExplorerQuery } from "~/modules/journal/journal-explorer.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  return json(await new JournalExplorer().listEntries(workspace, queryFromUrl(new URL(args.request.url))));
}

function queryFromUrl(url: URL): JournalExplorerQuery {
  return {
    page: Number(url.searchParams.get("page") || 1),
    pageSize: Number(url.searchParams.get("pageSize") || 50),
    journal: url.searchParams.get("journal"),
    source: url.searchParams.get("source") as never,
    account: url.searchParams.get("account"),
    dateFrom: url.searchParams.get("dateFrom"),
    dateTo: url.searchParams.get("dateTo"),
    search: url.searchParams.get("search"),
  };
}

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { AccountingChatCenter } from "~/modules/chat/accounting-chat-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  return json(await new AccountingChatCenter().getChatReadiness(workspace));
}

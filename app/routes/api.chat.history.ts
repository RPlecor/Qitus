import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { AccountingChatCenter } from "~/modules/chat/accounting-chat-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const conversationId = new URL(args.request.url).searchParams.get("conversationId");
  const center = new AccountingChatCenter();
  const conversations = await center.listConversations(workspace);
  const conversation = conversationId ? await center.getConversation(workspace, conversationId) : null;
  return json({ conversations, conversation });
}

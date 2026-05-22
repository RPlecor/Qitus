import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { AccountingChatCenter } from "~/modules/chat/accounting-chat-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { ExpectedRouteError, jsonOrRedirectError } from "~/modules/route-errors.server";

export async function action(args: ActionFunctionArgs) {
  const { request, params } = args;
  const workspace = await requireCompanyWorkspace(args);
  try {
    if (!params.id) throw new ExpectedRouteError("Conversation manquante.", 400);
    const conversation = await new AccountingChatCenter().archiveConversation(workspace, params.id);
    if (request.headers.get("accept")?.includes("application/json")) return json({ conversation });
    return redirect("/chat");
  } catch (error) {
    return jsonOrRedirectError(request, error, "/chat");
  }
}

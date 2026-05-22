import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { AccountingChatCenter } from "~/modules/chat/accounting-chat-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { jsonOrRedirectError } from "~/modules/route-errors.server";

export async function action(args: ActionFunctionArgs) {
  const { request } = args;
  const workspace = await requireCompanyWorkspace(args);
  try {
    const input = await parseChatInput(request);
    const result = await new AccountingChatCenter().sendMessage(workspace, input);
    const wantsSse = request.headers.get("accept")?.includes("text/event-stream");
    if (wantsSse) return sse(result);
    if (request.headers.get("accept")?.includes("application/json")) return json(result);
    return redirect(`/chat?conversationId=${encodeURIComponent(result.conversation.id)}`);
  } catch (error) {
    return jsonOrRedirectError(request, error, "/chat");
  }
}

async function parseChatInput(request: Request) {
  if (request.headers.get("content-type")?.includes("application/json")) {
    const body = await request.json() as { conversationId?: string; message?: string };
    return { conversationId: body.conversationId, message: body.message ?? "" };
  }
  const form = await request.formData();
  return {
    conversationId: String(form.get("conversationId") || "") || undefined,
    message: String(form.get("message") || ""),
  };
}

function sse(payload: unknown) {
  return new Response(`event: message\ndata: ${JSON.stringify(payload)}\n\nevent: done\ndata: {}\n\n`, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

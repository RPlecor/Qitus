import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { AppShell, KpiCard, Main } from "~/components/ui";
import { UsageMeter } from "~/modules/billing/usage-meter.server";
import { AccountingChatCenter } from "~/modules/chat/accounting-chat-center.server";
import { ChatContextBuilder } from "~/modules/chat/chat-context-builder.server";
import type { ChatReplyAction } from "~/modules/chat/chat-reply-guidance-center.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";
import { chatProviderLabel } from "~/modules/ui-labels";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const url = new URL(args.request.url);
  const conversationId = url.searchParams.get("conversationId");
  const center = new AccountingChatCenter();
  const [conversations, selected, context, readiness, usage] = await Promise.all([
    center.listConversations(workspace),
    conversationId ? center.getConversation(workspace, conversationId) : Promise.resolve(null),
    new ChatContextBuilder().buildChatContext(workspace),
    center.getChatReadiness(workspace),
    new UsageMeter().getUsageSummary(workspace),
  ]);
  return json({ conversations, selected, readiness, references: context.references, usage });
}

export default function Chat() {
  const { conversations, selected, readiness, references, usage } = useLoaderData<typeof loader>();
  const selectedId = selected?.conversation.id ?? "";

  return (
    <AppShell active="chat">
      <Main title="Chat comptable" subtitle="Lecture seule · contexte Qitus">
        <div className="alert blue">
          <strong>Chat en lecture seule</strong>
          <span>{readiness.message} Connecteur : {chatProviderLabel(readiness.provider)} · modèle : {readiness.model}.</span>
        </div>
        <div className="kpi-grid">
          <KpiCard label="IA ce mois" value={`${usage.usage.aiCalls}/${usage.subscription.limits.aiCallsPerMonth}`} hint="Quota du plan" />
          <KpiCard label="Imports ce mois" value={`${usage.usage.imports}/${usage.subscription.limits.importsPerMonth}`} hint="Quota du plan" />
        </div>
        <div className="chat-layout">
          <aside className="chat-sidebar">
            <Link className="btn btn-p chat-new-btn" to="/chat">+ Nouvelle conversation</Link>
            <nav className="chat-history">
              {conversations.map((conversation) => (
                <Link key={conversation.id} className={`chat-history-item ${conversation.id === selectedId ? "active" : ""}`} to={`/chat?conversationId=${conversation.id}`}>
                  {conversation.title}
                </Link>
              ))}
              {conversations.length === 0 ? <span className="sub">Aucun historique.</span> : null}
            </nav>
          </aside>

          <section className="chat-main">
            {selected ? (
              <div className="chat-main-head">
                <h2>{selected.conversation.title}</h2>
                <Form method="post" action={`/api/chat/conversations/${selected.conversation.id}/archive`}>
                  <button className="btn btn-sm" type="submit">Archiver</button>
                </Form>
              </div>
            ) : null}
            <div className="chat-thread">
              {selected?.messages.map((message) => (
                <div key={message.id} className={`chat-message ${message.role === "USER" ? "user" : "assistant"}`}>
                  <strong>{message.role === "USER" ? "Vous" : "Qitus"}</strong>
                  <p>{message.content}</p>
                  {message.role !== "USER" ? <ChatMessageActions metadata={message.metadata} /> : null}
                </div>
              ))}
              {!selected ? (
                <div className="chat-empty">
                  <p className="sub">Posez une question sur la clôture, les transactions, les OD ou les documents.</p>
                  <p className="sub mono">{chatProviderLabel(readiness.provider)} · {readiness.model}</p>
                </div>
              ) : null}
            </div>
            <Form method="post" action="/api/chat/message" className="chat-input">
              <input type="hidden" name="conversationId" value={selectedId} />
              <textarea name="message" rows={2} required placeholder="Pourquoi la clôture est bloquée ?" />
              <button className="btn btn-p" type="submit">Envoyer</button>
            </Form>
            {references.length > 0 ? (
              <div className="chat-refs sub">Références : {references.map((reference) => reference.label).join(" · ")}</div>
            ) : null}
          </section>
        </div>
      </Main>
    </AppShell>
  );
}

function ChatMessageActions({ metadata }: { metadata: unknown }) {
  const actions = extractActions(metadata);
  if (actions.length === 0) return null;
  return (
    <div className="chat-message-actions">
      {actions.map((action) => (
        <Link key={`${action.href}-${action.label}`} to={action.href} className={action.kind === "primary" ? "primary" : ""}>
          {action.label}
        </Link>
      ))}
    </div>
  );
}

function extractActions(metadata: unknown): ChatReplyAction[] {
  if (!metadata || typeof metadata !== "object" || !("actions" in metadata) || !Array.isArray(metadata.actions)) return [];
  return metadata.actions.filter(isChatReplyAction);
}

function isChatReplyAction(value: unknown): value is ChatReplyAction {
  return Boolean(
    value
      && typeof value === "object"
      && "label" in value
      && typeof value.label === "string"
      && "href" in value
      && typeof value.href === "string"
      && value.href.startsWith("/")
  );
}

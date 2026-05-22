import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { AppShell, Main } from "~/components/ui";
import { UsageMeter } from "~/modules/billing/usage-meter.server";
import { AccountingChatCenter } from "~/modules/chat/accounting-chat-center.server";
import { ChatContextBuilder } from "~/modules/chat/chat-context-builder.server";
import { requireCompanyWorkspace } from "~/modules/company-workspace/company-workspace.server";

export async function loader(args: LoaderFunctionArgs) {
  const workspace = await requireCompanyWorkspace(args);
  const url = new URL(args.request.url);
  const conversationId = url.searchParams.get("conversationId");
  const center = new AccountingChatCenter();
  const [conversations, selected, usage, context, readiness] = await Promise.all([
    center.listConversations(workspace),
    conversationId ? center.getConversation(workspace, conversationId) : Promise.resolve(null),
    new UsageMeter().getUsageSummary(workspace),
    new ChatContextBuilder().buildChatContext(workspace),
    center.getChatReadiness(workspace),
  ]);
  const documentFreshness = context.documentFreshness as { staleCount?: number };
  return json({ conversations, selected, usage, readiness, references: context.references, documentStaleCount: documentFreshness.staleCount ?? 0 });
}

export default function Chat() {
  const { conversations, selected, usage, readiness, references, documentStaleCount } = useLoaderData<typeof loader>();
  const selectedId = selected?.conversation.id ?? "";

  return (
    <AppShell active="chat">
      <Main title="Chat comptable" subtitle="Lecture seule · contexte Paperasse">
        <div className="alert blue">
          <strong>Chat en lecture seule</strong>
          <span>{readiness.message} Provider : {readiness.provider} · modèle : {readiness.model}.</span>
        </div>
        <div className="kpi-grid">
          <div className="kpi"><div className="kpi-label">Plan</div><span className="kpi-val">{usage.subscription.tier}</span></div>
          <div className="kpi"><div className="kpi-label">IA ce mois</div><span className="kpi-val">{usage.usage.aiCalls}/{usage.subscription.limits.aiCallsPerMonth}</span></div>
          <div className="kpi"><div className="kpi-label">Imports ce mois</div><span className="kpi-val">{usage.usage.imports}/{usage.subscription.limits.importsPerMonth}</span></div>
          <div className="kpi"><div className="kpi-label">Documents</div><span className="kpi-val">{documentStaleCount ? "À régénérer" : "À jour"}</span></div>
        </div>

        <div className="form-row" style={{ alignItems: "start" }}>
          <section className="card" style={{ minWidth: 260 }}>
            <h2>Conversations</h2>
            <div className="row-actions" style={{ flexDirection: "column", alignItems: "stretch" }}>
              <Link className="btn btn-sm" to="/chat">Nouvelle conversation</Link>
              {conversations.map((conversation) => (
                <Link key={conversation.id} className={`btn btn-sm ${conversation.id === selectedId ? "btn-p" : ""}`} to={`/chat?conversationId=${conversation.id}`}>
                  {conversation.title}
                </Link>
              ))}
              {conversations.length === 0 ? <span className="sub">Aucun historique.</span> : null}
            </div>
          </section>

          <section className="card" style={{ flex: 1 }}>
            <h2>Conversation</h2>
            {selected ? (
              <Form method="post" action={`/api/chat/conversations/${selected.conversation.id}/archive`} className="form-actions">
                <button className="btn btn-sm" type="submit">Archiver</button>
              </Form>
            ) : null}
            <div className="chat-thread">
              {selected?.messages.map((message) => (
                <div key={message.id} className={`chat-message ${message.role === "USER" ? "user" : "assistant"}`}>
                  <strong>{message.role === "USER" ? "Vous" : "Paperasse"}</strong>
                  <p>{message.content}</p>
                </div>
              ))}
              {!selected ? <p className="sub">Posez une question sur la clôture, les transactions, les OD ou les documents.</p> : null}
            </div>
            <Form method="post" action="/api/chat/message" className="form-card">
              <input type="hidden" name="conversationId" value={selectedId} />
              <label>
                Message
                <textarea name="message" rows={4} required placeholder="Pourquoi la clôture est bloquée ?" />
              </label>
              <div className="form-actions">
                <button className="btn btn-p" type="submit">Envoyer</button>
                <Link className="btn" to="/abonnement">Voir usage</Link>
              </div>
            </Form>
            <div className="alert">
              <strong>Références utilisées</strong>
              <span>{references.map((reference) => `${reference.label} (${reference.href})`).join(" · ")}</span>
            </div>
          </section>
        </div>
      </Main>
    </AppShell>
  );
}

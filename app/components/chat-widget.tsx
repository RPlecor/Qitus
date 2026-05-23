import { Link, useLocation } from "@remix-run/react";
import { MessageCircle, Plus, Send, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { ChatReplyAction } from "~/modules/chat/chat-reply-guidance-center.server";
import type { QitusKnowledgeSource } from "~/modules/chat/qitus-knowledge-center.server";

type WidgetMessage = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  metadata?: unknown;
  createdAt: string;
};

type WidgetConversation = {
  id: string;
  title: string;
};

type HistoryResponse = {
  conversations: WidgetConversation[];
  conversation: { conversation: WidgetConversation; messages: WidgetMessage[] } | null;
};

type MessageResponse = {
  conversation: WidgetConversation;
  assistantMessage: WidgetMessage;
  userMessage: WidgetMessage;
  sources?: QitusKnowledgeSource[];
};

type ReadinessResponse = {
  canUseChat: boolean;
  safeMessage?: string;
  remainingAiCalls?: number;
};

const STORAGE_KEY = "qitus.chat-widget.open";

export function ChatWidget() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string>("");
  const [messages, setMessages] = useState<WidgetMessage[]>([]);
  const [input, setInput] = useState("");
  const [readiness, setReadiness] = useState<ReadinessResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const chips = useMemo(() => chipsForPath(location.pathname), [location.pathname]);

  useEffect(() => {
    setOpen(window.sessionStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  useEffect(() => {
    window.sessionStorage.setItem(STORAGE_KEY, open ? "1" : "0");
    if (open) void loadChat();
  }, [open]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function loadChat() {
    try {
      const [historyResponse, readinessResponse] = await Promise.all([
        fetch("/api/chat/history", { headers: { Accept: "application/json" } }),
        fetch("/api/chat/readiness", { headers: { Accept: "application/json" } }),
      ]);
      if (historyResponse.ok) {
        const history = await historyResponse.json() as HistoryResponse;
        const latest = history.conversation ?? (history.conversations[0] ? await loadConversation(history.conversations[0].id) : null);
        setConversationId(latest?.conversation.id ?? "");
        setMessages(latest?.messages ?? []);
      }
      if (readinessResponse.ok) setReadiness(await readinessResponse.json() as ReadinessResponse);
    } catch {
      setError("Connexion interrompue. Votre question pourra être réessayée.");
    }
  }

  async function loadConversation(id: string) {
    const response = await fetch(`/api/chat/history?conversationId=${encodeURIComponent(id)}`, { headers: { Accept: "application/json" } });
    if (!response.ok) return null;
    return (await response.json() as HistoryResponse).conversation;
  }

  async function sendMessage(message = input) {
    const content = message.trim();
    if (!content || loading) return;
    setInput("");
    setError(null);
    setLoading(true);
    const tempMessage: WidgetMessage = {
      id: `local-${Date.now()}`,
      role: "USER",
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((current) => [...current, tempMessage]);
    try {
      const response = await fetch("/api/chat/message", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: conversationId || undefined, message: content }),
      });
      const payload = await response.json() as MessageResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Le chat n'a pas pu répondre.");
      setConversationId(payload.conversation.id);
      setMessages((current) => [
        ...current.filter((item) => item.id !== tempMessage.id),
        payload.userMessage,
        payload.assistantMessage,
      ]);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Le chat n'a pas pu répondre.");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
    if (event.key === "Escape") setOpen(false);
  }

  function newConversation() {
    setConversationId("");
    setMessages([]);
    setError(null);
  }

  return (
    <>
      <button
        type="button"
        className={`chat-widget-fab ${open ? "is-open" : ""}`}
        aria-label={open ? "Fermer l'assistant Qitus" : "Ouvrir l'assistant Qitus"}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="chat-widget-fab-tooltip">Une question sur Qitus ?</span>
        {open ? <X aria-hidden size={24} /> : <MessageCircle aria-hidden size={24} />}
      </button>

      <section className={`chat-widget-panel ${open ? "is-open" : ""}`} role="dialog" aria-label="Assistant Qitus" aria-modal="false">
        <header className="chat-widget-header">
          <span className="chat-widget-avatar"><MessageCircle aria-hidden size={20} /></span>
          <span className="chat-widget-title-wrap">
            <strong>Assistant Qitus</strong>
            <span>{readiness?.canUseChat === false ? "Limite atteinte" : "En ligne"}</span>
          </span>
          <button type="button" className="chat-widget-header-btn" aria-label="Nouvelle conversation" onClick={newConversation}>
            <Plus aria-hidden size={16} />
          </button>
          <button type="button" className="chat-widget-header-btn chat-widget-mobile-close" aria-label="Fermer" onClick={() => setOpen(false)}>
            <X aria-hidden size={16} />
          </button>
        </header>

        {messages.length === 0 ? (
          <div className="chat-widget-welcome">
            <span className="chat-widget-welcome-icon">?</span>
            <h3>Bonjour ! Comment puis-je vous aider ?</h3>
            <p>Posez une question sur Qitus, vos écrans, vos imports, vos documents ou les actions à réaliser.</p>
            <div className="chat-widget-chips">
              {chips.map((chip) => (
                <button key={chip} type="button" className="chat-widget-chip" onClick={() => void sendMessage(chip)}>
                  {chip}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="chat-widget-messages" ref={threadRef} role="log" aria-live="polite">
            {messages.map((message) => (
              <ChatWidgetMessage key={message.id} message={message} />
            ))}
            {loading ? <TypingIndicator /> : null}
            {error ? (
              <div className="chat-widget-error">
                <span>{error}</span>
                <button type="button" onClick={() => void sendMessage(messages.filter((message) => message.role === "USER").at(-1)?.content ?? "")}>Réessayer</button>
              </div>
            ) : null}
          </div>
        )}

        <div className="chat-widget-disclaimer">
          Outil pédagogique — ne constitue pas un avis comptable. <Link to="/privacy">En savoir plus</Link>
        </div>
        <form className="chat-widget-input" onSubmit={(event) => { event.preventDefault(); void sendMessage(); }}>
          <textarea
            aria-label="Votre message"
            value={input}
            rows={1}
            placeholder={readiness?.canUseChat === false ? "Limite mensuelle atteinte" : "Posez votre question..."}
            disabled={readiness?.canUseChat === false || loading}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button type="submit" aria-label="Envoyer" title="Envoyer" disabled={!input.trim() || loading || readiness?.canUseChat === false}>
            <Send aria-hidden size={18} />
          </button>
        </form>
      </section>
    </>
  );
}

function ChatWidgetMessage({ message }: { message: WidgetMessage }) {
  const isUser = message.role === "USER";
  const actions = extractActions(message.metadata);
  const sources = extractSources(message.metadata);
  return (
    <article className={`chat-widget-message ${isUser ? "user" : "assistant"}`}>
      {!isUser ? <span className="chat-widget-message-avatar"><MessageCircle aria-hidden size={14} /></span> : null}
      <div className="chat-widget-message-body">
        <div className="chat-widget-message-bubble">{message.content}</div>
        {!isUser && actions.length > 0 ? (
          <div className="chat-widget-actions">
            {actions.map((action) => (
              <Link key={`${action.href}-${action.label}`} to={action.href} className={action.kind === "primary" ? "primary" : ""}>
                {action.label}
              </Link>
            ))}
          </div>
        ) : null}
        <time>{formatTime(message.createdAt)}</time>
        {!isUser && sources.length > 0 ? (
          <div className="chat-widget-sources">
            <strong>SOURCES</strong>
            {sources.map((source) => source.href ? (
              <Link key={source.sourceId} to={source.href}>{source.title}</Link>
            ) : (
              <span key={source.sourceId}>{source.title}</span>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function TypingIndicator() {
  return (
    <div className="chat-widget-typing" aria-label="L'assistant rédige une réponse">
      <span className="chat-widget-message-avatar"><MessageCircle aria-hidden size={14} /></span>
      <span className="chat-widget-typing-bubble">
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}

function extractSources(metadata: unknown): QitusKnowledgeSource[] {
  if (!metadata || typeof metadata !== "object") return [];
  const value = "knowledgeSources" in metadata ? metadata.knowledgeSources : "sources" in metadata ? metadata.sources : null;
  return Array.isArray(value) ? value.filter(isKnowledgeSource) : [];
}

function extractActions(metadata: unknown): ChatReplyAction[] {
  if (!metadata || typeof metadata !== "object" || !("actions" in metadata) || !Array.isArray(metadata.actions)) return [];
  return metadata.actions.filter(isChatReplyAction);
}

function isKnowledgeSource(value: unknown): value is QitusKnowledgeSource {
  return Boolean(value && typeof value === "object" && "sourceId" in value && "title" in value);
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

function formatTime(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function chipsForPath(pathname: string) {
  if (pathname.startsWith("/imports")) return ["Pourquoi mon import est en revue ?", "Comment relancer la catégorisation ?", "Où corriger les colonnes ?"];
  if (pathname.startsWith("/transactions")) return ["Pourquoi cette transaction est à vérifier ?", "Comment corriger une transaction ?", "Où rattacher un justificatif ?"];
  if (pathname.startsWith("/tva")) return ["Pourquoi ma TVA est à zéro ?", "Comment régénérer la CA3 ?", "Que vérifier avant la TVA ?"];
  if (pathname.startsWith("/cloture")) return ["Pourquoi la clôture est bloquée ?", "Que sont les OD de clôture ?", "Quels documents générer ?"];
  if (pathname.startsWith("/documents")) return ["Pourquoi mes documents sont à mettre à jour ?", "Comment générer le FEC ?", "Où résoudre un blocage ?"];
  if (pathname.startsWith("/connecteurs")) return ["Comment configurer un connecteur ?", "Pourquoi la banque est indisponible ?", "Que fait Qonto bancaire ?"];
  return ["Que dois-je faire maintenant ?", "Pourquoi mon dossier n’est pas à jour ?", "Où importer un CSV ?", "Comment vérifier mes transactions ?"];
}

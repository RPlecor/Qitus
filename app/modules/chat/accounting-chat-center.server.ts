import { Prisma, type ChatConversation, type ChatMessage } from "@prisma/client";
import { ActivityLogCenter } from "../activity-log/activity-log-center.server";
import { EntitlementGate } from "../billing/entitlement-gate.server";
import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { prisma } from "../db.server";
import { ExpectedRouteError } from "../route-errors.server";
import { getRuntimeConfig, type RuntimeConfig } from "../runtime-config.server";
import { createAccountingChatProvider, type AccountingChatMessage, type AccountingChatProvider } from "./accounting-chat-provider.server";
import { ChatContextBuilder } from "./chat-context-builder.server";
import { ChatReadOnlyPolicy } from "./chat-read-only-policy.server";

export type ChatConversationSummary = {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  messageCount: number;
};

export type ChatMessageSummary = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  provider: string | null;
  model: string | null;
  metadata: unknown;
  createdAt: string;
};

export type ChatReadiness = {
  provider: string;
  model: string;
  readOnly: true;
  canUseChat: boolean;
  remainingAiCalls: number;
  message: string;
};

export class AccountingChatCenter {
  constructor(
    private readonly provider: AccountingChatProvider = createAccountingChatProvider(),
    private readonly contextBuilder = new ChatContextBuilder(),
    private readonly entitlements = new EntitlementGate(),
    private readonly activity = new ActivityLogCenter(),
    private readonly policy = new ChatReadOnlyPolicy(),
    private readonly config: RuntimeConfig = getRuntimeConfig()
  ) {}

  async startConversation(workspace: CompanyWorkspace, input: { message: string }) {
    return this.sendMessage(workspace, { message: input.message });
  }

  async sendMessage(workspace: CompanyWorkspace, input: { conversationId?: string | null; message: string }) {
    const message = input.message.trim();
    if (!message) throw new ExpectedRouteError("Message vide.", 400);
    const conversation = input.conversationId
      ? await this.requireConversation(workspace, input.conversationId)
      : await this.createConversation(workspace, message);

    const userMessage = await prisma.chatMessage.create({
      data: { conversationId: conversation.id, role: "USER", content: message },
    });
    await this.activity.recordActivity(workspace, {
      action: "chat.message_sent",
      entityType: "chat",
      entityId: conversation.id,
      metadata: { messageId: userMessage.id },
    });

    const context = await this.contextBuilder.buildChatContext(workspace);
    const decision = this.policy.evaluateMessage(message, context.references);
    if (decision.allowed) await this.entitlements.assertCanUse(workspace, "chat");
    const history = await this.messagesForProvider(conversation.id);
    const reply = decision.allowed
      ? await this.generateReply(workspace, conversation.id, history, context)
      : await this.persistPolicyReply(workspace, conversation.id, decision);
    if (decision.allowed) {
      await this.entitlements.recordUsage(workspace, "chat", { conversationId: conversation.id });
    }
    await prisma.chatConversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
    return {
      conversation: summarizeConversation({ ...conversation, _count: { messages: history.length + 1 } }),
      userMessage: summarizeMessage(userMessage),
      assistantMessage: summarizeMessage(reply),
      context,
    };
  }

  async listConversations(workspace: CompanyWorkspace, options: { includeArchived?: boolean } = {}): Promise<ChatConversationSummary[]> {
    const rows = await prisma.chatConversation.findMany({
      where: {
        companyId: workspace.company.id,
        fiscalYearId: workspace.fiscalYear.id,
        ...(options.includeArchived ? {} : { status: "OPEN" }),
      },
      include: { _count: { select: { messages: true } } },
      orderBy: { updatedAt: "desc" },
      take: 25,
    });
    return rows.map(summarizeConversation);
  }

  async getConversation(workspace: CompanyWorkspace, conversationId: string) {
    const conversation = await this.requireConversation(workspace, conversationId);
    const messages = await prisma.chatMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "asc" },
    });
    return { conversation, messages: messages.map(summarizeMessage) };
  }

  async archiveConversation(workspace: CompanyWorkspace, conversationId: string) {
    const conversation = await this.requireConversation(workspace, conversationId);
    const archived = await prisma.chatConversation.update({
      where: { id: conversation.id },
      data: { status: "ARCHIVED", updatedAt: new Date() },
      include: { _count: { select: { messages: true } } },
    });
    await this.activity.recordActivity(workspace, {
      action: "chat.conversation_archived",
      entityType: "chat",
      entityId: conversation.id,
      metadata: { title: conversation.title },
    });
    return summarizeConversation(archived);
  }

  async getChatReadiness(workspace: CompanyWorkspace): Promise<ChatReadiness> {
    const entitlement = await this.entitlements.getEntitlementStatus(workspace, "chat");
    const canUseChat = entitlement.allowed;
    return {
      provider: this.config.chatProvider,
      model: this.config.chatModel,
      readOnly: true,
      canUseChat,
      remainingAiCalls: entitlement.summary.remaining.aiCalls,
      message: canUseChat
        ? "Chat prêt en lecture seule."
        : "Quota chat atteint pour ce mois. Consultez /abonnement.",
    };
  }

  private async createConversation(workspace: CompanyWorkspace, firstMessage: string) {
    return prisma.chatConversation.create({
      data: {
        companyId: workspace.company.id,
        fiscalYearId: workspace.fiscalYear.id,
        title: titleFromMessage(firstMessage),
      },
    });
  }

  private async requireConversation(workspace: CompanyWorkspace, conversationId: string) {
    const conversation = await prisma.chatConversation.findFirst({
      where: { id: conversationId, companyId: workspace.company.id, fiscalYearId: workspace.fiscalYear.id },
    });
    if (!conversation) throw new ExpectedRouteError("Conversation introuvable.", 404);
    return conversation;
  }

  private async messagesForProvider(conversationId: string): Promise<AccountingChatMessage[]> {
    const messages = await prisma.chatMessage.findMany({ where: { conversationId }, orderBy: { createdAt: "asc" } });
    return messages.map((message) => ({ role: message.role.toLowerCase() as AccountingChatMessage["role"], content: message.content }));
  }

  private async generateReply(
    workspace: CompanyWorkspace,
    conversationId: string,
    history: AccountingChatMessage[],
    context: Awaited<ReturnType<ChatContextBuilder["buildChatContext"]>>
  ): Promise<ChatMessage> {
    try {
      const reply = await this.provider.reply(history, context);
      const safeReply = this.policy.sanitizeAssistantReply(reply, context.references);
      const message = await prisma.chatMessage.create({
        data: {
          conversationId,
          role: "ASSISTANT",
          content: safeReply.content,
          provider: safeReply.provider,
          model: safeReply.model,
          metadataJson: safeReply.metadata as Prisma.InputJsonValue | undefined,
        },
      });
      await this.activity.recordActivity(workspace, {
        action: "chat.reply_generated",
        entityType: "chat",
        entityId: conversationId,
        metadata: { provider: safeReply.provider, model: safeReply.model, messageId: message.id },
      });
      return message;
    } catch (error) {
      const content = providerFailureMessage(error);
      const message = await prisma.chatMessage.create({
        data: {
          conversationId,
          role: "ASSISTANT",
          content,
          provider: "codex-cli",
          model: null,
          metadataJson: { error: error instanceof Error ? error.message : String(error) },
        },
      });
      await this.activity.recordActivity(workspace, {
        action: "chat.reply_failed",
        entityType: "chat",
        entityId: conversationId,
        metadata: { message: content },
      });
      return message;
    }
  }

  private async persistPolicyReply(
    workspace: CompanyWorkspace,
    conversationId: string,
    decision: ReturnType<ChatReadOnlyPolicy["evaluateMessage"]>
  ) {
    const reply = this.policy.buildBlockedReply(decision);
    const message = await prisma.chatMessage.create({
      data: {
        conversationId,
        role: "ASSISTANT",
        content: reply.content,
        provider: reply.provider,
        model: reply.model,
        metadataJson: reply.metadata as Prisma.InputJsonValue,
      },
    });
    await this.activity.recordActivity(workspace, {
      action: "chat.reply_generated",
      entityType: "chat",
      entityId: conversationId,
      metadata: { provider: reply.provider, model: reply.model, blockedMutation: true, messageId: message.id },
    });
    return message;
  }
}

function summarizeConversation(row: ChatConversation & { _count?: { messages: number } }): ChatConversationSummary {
  return {
    id: row.id,
    title: row.title ?? "Conversation",
    status: row.status,
    updatedAt: row.updatedAt.toISOString(),
    messageCount: row._count?.messages ?? 0,
  };
}

function summarizeMessage(row: ChatMessage): ChatMessageSummary {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    provider: row.provider,
    model: row.model,
    metadata: row.metadataJson,
    createdAt: row.createdAt.toISOString(),
  };
}

function titleFromMessage(message: string) {
  return message.length > 70 ? `${message.slice(0, 67)}...` : message;
}

function providerFailureMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("Codex CLI")) return message;
  return "Le chat n'a pas pu répondre pour le moment. Vérifiez que Codex CLI est connecté avec `codex --login`.";
}

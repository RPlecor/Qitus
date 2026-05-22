import { Webhook, WebhookVerificationError } from "svix";
import { Prisma, type User } from "@prisma/client";
import { prisma } from "../db.server";
import { getRuntimeConfig } from "../runtime-config.server";
import { ExpectedRouteError } from "../route-errors.server";

export type ClerkWebhookEvent = {
  id: string;
  type: "user.created" | "user.updated" | "user.deleted" | string;
  data: {
    id?: string;
    email_addresses?: Array<{ email_address?: string; id?: string }>;
    primary_email_address_id?: string;
    first_name?: string | null;
    last_name?: string | null;
  };
};

export type WebhookClaim = { duplicate: boolean };

export interface WebhookEventStore {
  claimEvent(event: { provider: string; eventId: string; eventType: string }): Promise<WebhookClaim>;
  markProcessed(eventId: string): Promise<void>;
  markFailed(eventId: string, message: string): Promise<void>;
}

export interface ClerkUserSync {
  syncUserFromClerkEvent(event: ClerkWebhookEvent): Promise<User | null>;
}

export class ClerkWebhookReceiver {
  constructor(
    private readonly options: {
      secret?: string;
      eventStore?: WebhookEventStore;
      userSync?: ClerkUserSync;
    } = {}
  ) {}

  async verifyAndParse(request: Request): Promise<ClerkWebhookEvent> {
    const secret = this.options.secret ?? getRuntimeConfig().clerkWebhookSecret;
    if (!secret) throw new ExpectedRouteError("CLERK_WEBHOOK_SECRET is required to receive Clerk webhooks.", 500);

    const payload = await request.text();
    try {
      return new Webhook(secret).verify(payload, svixHeaders(request)) as ClerkWebhookEvent;
    } catch (error) {
      if (error instanceof WebhookVerificationError) throw new ExpectedRouteError("Invalid Clerk webhook signature.", 401);
      throw error;
    }
  }

  async handleEvent(event: ClerkWebhookEvent) {
    if (!event.id) throw new ExpectedRouteError("Missing Clerk webhook event id.", 400);

    const eventStore = this.options.eventStore ?? new PrismaWebhookEventStore();
    const claim = await eventStore.claimEvent({ provider: "clerk", eventId: event.id, eventType: event.type });
    if (claim.duplicate) return { duplicate: true };

    try {
      const user = await (this.options.userSync ?? new PrismaClerkUserSync()).syncUserFromClerkEvent(event);
      await eventStore.markProcessed(event.id);
      return { duplicate: false, userId: user?.id ?? null };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Clerk webhook processing failed.";
      await eventStore.markFailed(event.id, message);
      throw error;
    }
  }

  async syncUserFromClerkEvent(event: ClerkWebhookEvent) {
    return (this.options.userSync ?? new PrismaClerkUserSync()).syncUserFromClerkEvent(event);
  }
}

export class PrismaWebhookEventStore implements WebhookEventStore {
  async claimEvent(event: { provider: string; eventId: string; eventType: string }) {
    try {
      await prisma.webhookEvent.create({
        data: {
          provider: event.provider,
          eventId: event.eventId,
          eventType: event.eventType,
          status: "PROCESSING",
        },
      });
      return { duplicate: false };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { duplicate: true };
      throw error;
    }
  }

  async markProcessed(eventId: string) {
    await prisma.webhookEvent.update({
      where: { eventId },
      data: { status: "PROCESSED", processedAt: new Date(), errorMessage: null },
    });
  }

  async markFailed(eventId: string, message: string) {
    await prisma.webhookEvent.update({
      where: { eventId },
      data: { status: "FAILED", processedAt: new Date(), errorMessage: message },
    });
  }
}

export class PrismaClerkUserSync implements ClerkUserSync {
  async syncUserFromClerkEvent(event: ClerkWebhookEvent) {
    const clerkId = event.data.id;
    if (!clerkId) throw new ExpectedRouteError("Missing Clerk user id.", 400);

    if (event.type === "user.deleted") {
      const user = await prisma.user.findUnique({ where: { clerkId }, include: { companies: true } });
      if (!user) return null;
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: {
          email: `deleted-${clerkId}@clerk.paperasse.local`,
          name: null,
          deletedAt: new Date(),
          anonymizedAt: new Date(),
        },
      });
      await recordWebhookActivity(updated.id, user.companies[0]?.id, event);
      return updated;
    }

    const email = primaryEmail(event) ?? `${clerkId}@clerk.paperasse.local`;
    const name = [event.data.first_name, event.data.last_name].filter(Boolean).join(" ") || null;
    const user = await prisma.user.upsert({
      where: { clerkId },
      update: { email, name },
      create: { clerkId, email, name },
      include: { companies: true },
    });
    await recordWebhookActivity(user.id, user.companies[0]?.id, event);
    return user;
  }
}

export function primaryEmail(event: ClerkWebhookEvent) {
  const emails = event.data.email_addresses ?? [];
  const primary = emails.find((email) => email.id === event.data.primary_email_address_id);
  return primary?.email_address ?? emails[0]?.email_address;
}

function svixHeaders(request: Request) {
  return {
    "svix-id": request.headers.get("svix-id") ?? "",
    "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
    "svix-signature": request.headers.get("svix-signature") ?? "",
  };
}

async function recordWebhookActivity(userId: string, companyId: string | undefined, event: ClerkWebhookEvent) {
  if (!companyId) return;
  await prisma.activityLog.create({
    data: {
      companyId,
      userId,
      action: "webhook.clerk_user_synced",
      entityType: "webhook",
      entityId: event.id,
      metadata: { type: event.type, clerkUserId: event.data.id },
    },
  });
}

import { Webhook } from "svix";
import { describe, expect, it, vi } from "vitest";
import {
  ClerkWebhookReceiver,
  type ClerkWebhookEvent,
  type ClerkUserSync,
  type WebhookEventStore,
} from "../app/modules/clerk-webhook/clerk-webhook-receiver.server";

const secret = `whsec_${Buffer.from("paperasse-test-secret").toString("base64")}`;

describe("ClerkWebhookReceiver", () => {
  it("accepts a valid Svix signature", async () => {
    const event = clerkEvent("evt_valid");
    const request = signedRequest(event);

    await expect(new ClerkWebhookReceiver({ secret }).verifyAndParse(request)).resolves.toMatchObject({
      id: "evt_valid",
      type: "user.created",
    });
  });

  it("rejects missing or invalid signatures", async () => {
    const request = new Request("http://paperasse.local/webhooks/clerk", {
      method: "POST",
      body: JSON.stringify(clerkEvent("evt_invalid")),
    });

    await expect(new ClerkWebhookReceiver({ secret }).verifyAndParse(request)).rejects.toMatchObject({ status: 401 });
  });

  it("returns duplicate without syncing the user twice", async () => {
    const store = new MemoryWebhookEventStore(new Set(["evt_duplicate"]));
    const sync: ClerkUserSync = { syncUserFromClerkEvent: vi.fn() };
    const result = await new ClerkWebhookReceiver({ secret, eventStore: store, userSync: sync }).handleEvent(clerkEvent("evt_duplicate"));

    expect(result).toEqual({ duplicate: true });
    expect(sync.syncUserFromClerkEvent).not.toHaveBeenCalled();
  });
});

function signedRequest(event: ClerkWebhookEvent) {
  const payload = JSON.stringify(event);
  const timestamp = new Date();
  const signature = new Webhook(secret).sign(event.id, timestamp, payload);
  return new Request("http://paperasse.local/webhooks/clerk", {
    method: "POST",
    body: payload,
    headers: {
      "svix-id": event.id,
      "svix-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
      "svix-signature": signature,
    },
  });
}

function clerkEvent(id: string): ClerkWebhookEvent {
  return {
    id,
    type: "user.created",
    data: {
      id: "user_clerk_123",
      primary_email_address_id: "email_1",
      email_addresses: [{ id: "email_1", email_address: "rene@example.com" }],
      first_name: "Rene",
      last_name: "Corbu",
    },
  };
}

class MemoryWebhookEventStore implements WebhookEventStore {
  constructor(private readonly seen = new Set<string>()) {}

  async claimEvent(event: { eventId: string }) {
    if (this.seen.has(event.eventId)) return { duplicate: true };
    this.seen.add(event.eventId);
    return { duplicate: false };
  }

  async markProcessed() {}

  async markFailed() {}
}

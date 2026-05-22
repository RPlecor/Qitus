import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../db.server";
import { ExpectedRouteError } from "../route-errors.server";
import { getRuntimeConfig, type RuntimeConfig } from "../runtime-config.server";
import { createOpenBankingProviderAdapter } from "./open-banking-provider-adapter.server";

export class OpenBankingWebhookReceiver {
  constructor(private readonly config: RuntimeConfig = getRuntimeConfig()) {}

  async verifyAndHandleWebhook(request: Request) {
    if (this.config.openBankingProvider === "disabled") {
      throw new ExpectedRouteError("Open Banking désactivé.", 409);
    }
    const rawBody = await request.text();
    const signature = request.headers.get("x-open-banking-signature")
      ?? request.headers.get("x-bridge-signature")
      ?? request.headers.get("x-powens-signature");
    const valid = await createOpenBankingProviderAdapter(this.config).verifyWebhook(rawBody, signature);
    if (!valid) throw new ExpectedRouteError("Signature webhook Open Banking invalide.", 401);

    const payload = parsePayload(rawBody);
    const eventId = `open_banking:${payload.eventId ?? createHash("sha256").update(rawBody).digest("hex")}`;
    const eventType = payload.eventType ?? "unknown";
    const duplicate = await prisma.webhookEvent.findUnique({ where: { eventId } });
    if (duplicate) return { ok: true, duplicate: true, eventId, eventType, status: duplicate.status };

    const event = await prisma.webhookEvent.create({
      data: {
        provider: "open_banking",
        eventId,
        eventType,
        status: "PROCESSING",
      },
    });

    try {
      await this.applyWebhookSideEffect(payload);
      const processed = await prisma.webhookEvent.update({
        where: { id: event.id },
        data: { status: "PROCESSED", processedAt: new Date() },
      });
      return { ok: true, duplicate: false, eventId, eventType, status: processed.status };
    } catch (error) {
      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: {
          status: "FAILED",
          processedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : "Webhook Open Banking échoué.",
        },
      });
      throw error;
    }
  }

  private async applyWebhookSideEffect(payload: WebhookPayload) {
    if (!payload.providerConnectionId) return;
    const status = statusFromEvent(payload.eventType);
    if (!status) return;
    await prisma.bankConnection.updateMany({
      where: { providerConnectionId: payload.providerConnectionId },
      data: {
        status,
        metadataJson: {
          latestWebhook: {
            eventType: payload.eventType,
            receivedAt: new Date().toISOString(),
          },
        } as Prisma.InputJsonObject,
      },
    });
  }
}

type WebhookPayload = {
  eventId?: string;
  eventType?: string;
  providerConnectionId?: string;
};

function parsePayload(rawBody: string): WebhookPayload {
  if (!rawBody.trim()) return {};
  try {
    const parsed = JSON.parse(rawBody) as Record<string, unknown>;
    return {
      eventId: stringValue(parsed.eventId) ?? stringValue(parsed.id),
      eventType: stringValue(parsed.eventType) ?? stringValue(parsed.type),
      providerConnectionId: stringValue(parsed.providerConnectionId)
        ?? stringValue(parsed.connectionId)
        ?? stringValue(parsed.id_connection)
        ?? stringValue(parsed.item_id)
        ?? nestedString(parsed.item, "id")
        ?? nestedString(parsed.connection, "id"),
    };
  } catch {
    return {};
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function nestedString(value: unknown, key: string) {
  if (typeof value !== "object" || value === null || !(key in value)) return undefined;
  const nested = (value as Record<string, unknown>)[key];
  return typeof nested === "string" || typeof nested === "number" ? String(nested) : undefined;
}

function statusFromEvent(eventType?: string): "ACTIVE" | "EXPIRED" | "ERROR" | "REVOKED" | null {
  if (!eventType) return null;
  if (eventType.includes("expired")) return "EXPIRED";
  if (eventType.includes("revoked")) return "REVOKED";
  if (eventType.includes("error") || eventType.includes("failed")) return "ERROR";
  if (eventType.includes("active") || eventType.includes("renewed")) return "ACTIVE";
  return null;
}

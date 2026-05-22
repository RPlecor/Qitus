import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../db.server";
import { ExpectedRouteError } from "../route-errors.server";
import { createEInvoiceProviderAdapter, type EInvoiceProviderAdapter } from "./e-invoice-provider-adapter.server";
import { EInvoiceLifecycleCenter } from "./e-invoice-lifecycle-center.server";

export class EInvoiceProviderWebhookReceiver {
  constructor(
    private readonly adapter: EInvoiceProviderAdapter = createEInvoiceProviderAdapter(),
    private readonly lifecycle = new EInvoiceLifecycleCenter()
  ) {}

  async verifyAndHandleWebhook(request: Request) {
    const rawBody = await request.text();
    const valid = await this.adapter.verifyWebhook(request, rawBody);
    if (!valid) throw new ExpectedRouteError("Signature webhook facture électronique invalide.", 401);

    const payload = this.adapter.parseWebhook?.(rawBody) ?? {};
    const eventId = `e_invoice_provider:${payload.eventId ?? createHash("sha256").update(rawBody).digest("hex")}`;
    const eventType = payload.eventType ?? "unknown";
    const duplicate = await prisma.webhookEvent.findUnique({ where: { eventId } });
    if (duplicate) return { ok: true, duplicate: true, eventId, eventType, status: duplicate.status };

    const event = await prisma.webhookEvent.create({
      data: {
        provider: "e_invoice_provider",
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
          errorMessage: error instanceof Error ? error.message : "Webhook facture électronique échoué.",
        },
      });
      throw error;
    }
  }

  private async applyWebhookSideEffect(payload: Awaited<ReturnType<NonNullable<EInvoiceProviderAdapter["parseWebhook"]>>>) {
    if (payload.providerConnectionId) {
      await prisma.eInvoiceProviderConnection.updateMany({
        where: { providerConnectionId: payload.providerConnectionId },
        data: {
          status: connectionStatusFromEvent(payload.eventType),
          mandateStatus: mandateStatusFromEvent(payload.eventType),
          connectionStatus: connectionStatusFromEvent(payload.eventType),
          lastStatusSyncedAt: new Date(),
          safeMetadataJson: {
            latestWebhook: {
              eventType: payload.eventType ?? "unknown",
              providerInvoiceId: payload.providerInvoiceId,
              receivedAt: new Date().toISOString(),
            },
          } as Prisma.InputJsonObject,
        },
      });
    }

    if (payload.providerInvoiceId) {
      await prisma.eInvoice.updateMany({
        where: {
          source: "PROVIDER",
          sourceId: payload.providerInvoiceId,
        },
        data: {
          providerStatus: payload.providerStatus,
          status: this.lifecycle.toQitusStatus(payload.providerStatus),
          providerReceivedAt: parseDate(payload.providerReceivedAt),
          providerStatusSyncedAt: new Date(),
          providerMetadataJson: (payload.metadata ?? {}) as Prisma.InputJsonObject,
        },
      });
    }
  }
}

function connectionStatusFromEvent(eventType?: string): "ACTIVE" | "PENDING" | "ERROR" | "EXPIRED" | "REVOKED" {
  const value = eventType?.toLowerCase() ?? "";
  if (value.includes("revoked")) return "REVOKED";
  if (value.includes("expired")) return "EXPIRED";
  if (value.includes("error") || value.includes("failed")) return "ERROR";
  if (value.includes("pending")) return "PENDING";
  return "ACTIVE";
}

function mandateStatusFromEvent(eventType?: string) {
  return connectionStatusFromEvent(eventType);
}

function parseDate(value?: string) {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  activityLog: { findMany: vi.fn() },
  attachment: { findMany: vi.fn() },
  bankConnection: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  bankFeedSyncEvent: { findMany: vi.fn() },
  document: { findMany: vi.fn() },
  webhookEvent: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
}));

vi.mock("../app/modules/db.server", () => ({ prisma: prismaMock }));

import { MetricCatalog } from "../app/modules/deployment/metric-catalog.server";
import { WorkerRuntimeCenter } from "../app/modules/deployment/worker-runtime-center.server";
import { OpenBankingFreshnessCenter } from "../app/modules/open-banking/open-banking-freshness-center.server";
import { OpenBankingWebhookReceiver } from "../app/modules/open-banking/open-banking-webhook-receiver.server";
import { StorageAuditCenter } from "../app/modules/storage/storage-audit-center.server";
import { getRuntimeConfig } from "../app/modules/runtime-config.server";

const workspace = {
  user: { id: "user_1" },
  company: { id: "company_1", fiscalYears: [], bankAccounts: [] },
  fiscalYear: { id: "fy_1" },
  bankAccount: { id: "bank_1" },
  subscription: {},
  authMode: "dev",
} as never;

describe("Phase 16.5 infrastructure beta", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes a stable beta metric catalog", () => {
    const catalog = new MetricCatalog().assertRequiredMetricsPresent();
    expect(catalog.ok).toBe(true);
    expect(catalog.missing.map((metric) => metric.name)).toContain("open_banking.sync.completed");
  });

  it("reports worker and cron status without requiring a live process", () => {
    const status = new WorkerRuntimeCenter(getRuntimeConfig({
      DATABASE_URL: "postgresql://localhost:5432/paperasse",
      IMPORT_EXECUTION_MODE: "bullmq",
      CRON_MODE: "worker",
      REDIS_URL: "redis://localhost:6379",
    })).getRuntimeStatus();
    expect(status.worker.status).toBe("external_required");
    expect(status.cron.status).toBe("configured");
  });

  it("detects expired Open Banking consent", async () => {
    prismaMock.bankConnection.findMany.mockResolvedValue([{
      id: "conn_1",
      status: "ACTIVE",
      consentExpiresAt: new Date("2025-01-01"),
      lastSyncedAt: new Date("2025-01-01"),
    }]);
    const freshness = await new OpenBankingFreshnessCenter().getFreshness(workspace);
    expect(freshness.status).toBe("warning");
    expect(freshness.connections[0]?.status).toBe("expired");
  });

  it("handles Open Banking webhooks idempotently", async () => {
    prismaMock.webhookEvent.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ status: "PROCESSED" });
    prismaMock.webhookEvent.create.mockResolvedValue({ id: "webhook_1" });
    prismaMock.webhookEvent.update.mockResolvedValue({ status: "PROCESSED" });
    prismaMock.bankConnection.updateMany.mockResolvedValue({ count: 1 });

    const config = getRuntimeConfig({ DATABASE_URL: "postgresql://localhost:5432/paperasse", OPEN_BANKING_PROVIDER: "mock" });
    const receiver = new OpenBankingWebhookReceiver(config);
    const body = JSON.stringify({ eventId: "evt_1", eventType: "connection.expired", providerConnectionId: "mock-connection" });
    const first = await receiver.verifyAndHandleWebhook(new Request("http://localhost/webhooks/open-banking", { method: "POST", body }));
    const duplicate = await receiver.verifyAndHandleWebhook(new Request("http://localhost/webhooks/open-banking", { method: "POST", body }));

    expect(first).toMatchObject({ ok: true, duplicate: false });
    expect(duplicate).toMatchObject({ ok: true, duplicate: true });
  });

  it("detects missing stored artifacts without crashing", async () => {
    prismaMock.document.findMany.mockResolvedValue([{ id: "doc_1", filename: "fec.txt", storageKey: "missing/fec.txt", sizeBytes: 12 }]);
    prismaMock.attachment.findMany.mockResolvedValue([]);
    const audit = await new StorageAuditCenter(getRuntimeConfig({
      DATABASE_URL: "postgresql://localhost:5432/paperasse",
      DOCUMENT_STORAGE_DIR: "/private/tmp/paperasse-missing-docs",
    })).getStorageAudit(workspace);
    expect(audit.summary.missing).toBe(1);
    expect(audit.items[0]).toMatchObject({ kind: "document", available: false });
  });
});

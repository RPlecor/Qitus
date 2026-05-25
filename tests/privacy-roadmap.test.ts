import { describe, expect, it } from "vitest";
import { DataRetentionPolicy } from "../app/modules/privacy/data-retention-policy.server";
import { redactSensitive } from "../app/modules/deployment/security-hardening-center.server";

describe("privacy roadmap safeguards", () => {
  it("protects accounting evidence from automatic purge", async () => {
    const policy = new DataRetentionPolicy();
    await expect(policy.describe("journal_entry")).resolves.toMatchObject({ autoPurgeAllowed: false, protectedAccountingEvidence: true });
    await expect(policy.describe("document")).resolves.toMatchObject({ autoPurgeAllowed: false, protectedAccountingEvidence: true });
    await expect(policy.describe("attachment")).resolves.toMatchObject({ autoPurgeAllowed: false, protectedAccountingEvidence: true });
    await expect(policy.describe("expert_dossier")).resolves.toMatchObject({ autoPurgeAllowed: false, protectedAccountingEvidence: true });
  });

  it("allows automatic purge only for non-accounting temporary data", async () => {
    const policy = new DataRetentionPolicy();
    await expect(policy.describe("share_link")).resolves.toMatchObject({ autoPurgeAllowed: true, autoPurgeAfterDays: 30 });
    await expect(policy.describe("webhook_event")).resolves.toMatchObject({ autoPurgeAllowed: true, autoPurgeAfterDays: 90 });
    await expect(policy.describe("privacy_export")).resolves.toMatchObject({ autoPurgeAllowed: true, autoPurgeAfterDays: 7 });
  });

  it("redacts secrets, tokens and full IBAN values", () => {
    const redacted = redactSensitive({
      stripeSecret: "sk_test_abc123",
      nested: {
        authorization: "Bearer live_token",
        message: "Paiement depuis FR1420041010050500013M02606",
      },
    });
    const serialized = JSON.stringify(redacted);
    expect(serialized).not.toContain("sk_test_abc123");
    expect(serialized).not.toContain("live_token");
    expect(serialized).not.toContain("FR1420041010050500013M02606");
    expect(serialized).toContain("[redacted]");
  });
});

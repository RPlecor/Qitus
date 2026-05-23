import { describe, expect, it } from "vitest";
import { DataRetentionPolicy } from "../app/modules/privacy/data-retention-policy.server";
import { redactSensitive } from "../app/modules/deployment/security-hardening-center.server";

describe("privacy roadmap safeguards", () => {
  it("protects accounting evidence from automatic purge", () => {
    const policy = new DataRetentionPolicy();
    expect(policy.describe("journal_entry")).toMatchObject({ autoPurgeAllowed: false, protectedAccountingEvidence: true });
    expect(policy.describe("document")).toMatchObject({ autoPurgeAllowed: false, protectedAccountingEvidence: true });
    expect(policy.describe("attachment")).toMatchObject({ autoPurgeAllowed: false, protectedAccountingEvidence: true });
    expect(policy.describe("expert_dossier")).toMatchObject({ autoPurgeAllowed: false, protectedAccountingEvidence: true });
  });

  it("allows automatic purge only for non-accounting temporary data", () => {
    const policy = new DataRetentionPolicy();
    expect(policy.describe("share_link")).toMatchObject({ autoPurgeAllowed: true, autoPurgeAfterDays: 30 });
    expect(policy.describe("webhook_event")).toMatchObject({ autoPurgeAllowed: true, autoPurgeAfterDays: 90 });
    expect(policy.describe("privacy_export")).toMatchObject({ autoPurgeAllowed: true, autoPurgeAfterDays: 7 });
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

import { describe, expect, it } from "vitest";
import { DevIdentityAdapter, SubscriptionGateAdapter } from "../app/modules/company-workspace/company-workspace.server";

describe("CompanyWorkspace adapters", () => {
  it("keeps the deterministic dev identity for local demo mode", async () => {
    await expect(new DevIdentityAdapter().resolveIdentity()).resolves.toEqual({
      clerkId: "dev-user",
      email: "demo@paperasse.local",
      name: "Demo Paperasse",
    });
  });

  it("keeps subscription as an explicit active stub in local mode", async () => {
    await expect(new SubscriptionGateAdapter().getSubscription()).resolves.toMatchObject({
      tier: "SOLO",
      status: "ACTIVE_STUB",
      provider: "NONE",
      limits: { aiCallsPerMonth: 100, importsPerMonth: 5, requestsPerMinute: 60 },
    });
  });
});

import { describe, expect, it } from "vitest";
import { getRuntimeConfig } from "../app/modules/runtime-config.server";
import { getDemoLocalAccess, parseDemoResetForm } from "../app/modules/demo/demo-local-access.server";

describe("DemoLocalAccess", () => {
  it("allows the demo page only in dev mode on a local Paperasse database", () => {
    const config = getRuntimeConfig({
      AUTH_MODE: "dev",
      DATABASE_URL: "postgresql://rene@localhost:5432/paperasse",
    });

    expect(getDemoLocalAccess(config, { NODE_ENV: "development" })).toEqual({ allowed: true, reason: null });
  });

  it("blocks the demo page outside dev auth mode", () => {
    const config = getRuntimeConfig({
      AUTH_MODE: "clerk",
      DATABASE_URL: "postgresql://rene@localhost:5432/paperasse",
    });

    expect(getDemoLocalAccess(config, { NODE_ENV: "development" })).toMatchObject({ allowed: false });
  });

  it("blocks the demo page on non-local databases", () => {
    const config = getRuntimeConfig({
      AUTH_MODE: "dev",
      DATABASE_URL: "postgresql://rene@db.internal:5432/paperasse",
    });

    expect(getDemoLocalAccess(config, { NODE_ENV: "development" })).toMatchObject({ allowed: false });
  });

  it("requires explicit reset confirmation", () => {
    const form = new FormData();
    form.set("datasetId", "qonto_mvp");

    expect(() => parseDemoResetForm(form)).toThrow("Confirme le reset destructif");
  });

  it("parses a confirmed reset request", () => {
    const form = new FormData();
    form.set("datasetId", "closing_beta");
    form.set("confirmReset", "on");

    expect(parseDemoResetForm(form)).toEqual({ datasetId: "closing_beta" });
  });
});

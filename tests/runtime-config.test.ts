import { describe, expect, it } from "vitest";
import { assertRuntimeConfig, getRuntimeConfig } from "../app/modules/runtime-config.server";

describe("RuntimeConfig", () => {
  it("defaults to dev auth and codex-cli provider", () => {
    const config = getRuntimeConfig({ DATABASE_URL: "postgresql://localhost:5432/paperasse" });
    expect(config).toMatchObject({
      appEnv: "local",
      authMode: "dev",
      aiProvider: "codex-cli",
      codexCliBin: "codex",
      codexModel: "gpt-5.4-mini",
      importExecutionMode: "inline",
      redisUrl: "redis://localhost:6379",
      billingMode: "stub",
      chatProvider: "codex-cli",
      chatModel: "gpt-5.4-mini",
      objectStorageMode: "local",
      observabilityMode: "local",
      cronMode: "disabled",
      openBankingProvider: "disabled",
      changeImpactsMode: "shadow",
    });
  });

  it("supports the change impacts migration mode", () => {
    expect(getRuntimeConfig({ DATABASE_URL: "postgresql://localhost:5432/paperasse", CHANGE_IMPACTS_MODE: "off" }).changeImpactsMode).toBe("off");
    expect(getRuntimeConfig({ DATABASE_URL: "postgresql://localhost:5432/paperasse", CHANGE_IMPACTS_MODE: "active" }).changeImpactsMode).toBe("active");
    expect(() => getRuntimeConfig({ DATABASE_URL: "postgresql://localhost:5432/paperasse", CHANGE_IMPACTS_MODE: "loud" })).toThrow("CHANGE_IMPACTS_MODE");
  });

  it("requires Clerk keys only when AUTH_MODE=clerk", () => {
    expect(() => assertRuntimeConfig(getRuntimeConfig({
      AUTH_MODE: "clerk",
      DATABASE_URL: "postgresql://localhost:5432/paperasse",
    }))).toThrow("CLERK_PUBLISHABLE_KEY");

    expect(() => assertRuntimeConfig(getRuntimeConfig({
      AUTH_MODE: "clerk",
      DATABASE_URL: "postgresql://localhost:5432/paperasse",
      CLERK_PUBLISHABLE_KEY: "pk_test_123",
      CLERK_SECRET_KEY: "sk_test_123",
      CLERK_WEBHOOK_SECRET: "whsec_test_123",
    }))).not.toThrow();
  });

  it("requires Stripe keys only when BILLING_MODE=stripe", () => {
    expect(() => assertRuntimeConfig(getRuntimeConfig({
      DATABASE_URL: "postgresql://localhost:5432/paperasse",
      BILLING_MODE: "stripe",
    }))).toThrow("STRIPE_SECRET_KEY");

    expect(() => assertRuntimeConfig(getRuntimeConfig({
      DATABASE_URL: "postgresql://localhost:5432/paperasse",
      BILLING_MODE: "stripe",
      STRIPE_SECRET_KEY: "sk_test_123",
      STRIPE_WEBHOOK_SECRET: "whsec_123",
      STRIPE_PRICE_SOLO: "price_solo",
      STRIPE_PRICE_ENTREPRISE: "price_entreprise",
      STRIPE_PRICE_ENTREPRISE_PLUS: "price_plus",
    }))).not.toThrow();
  });

  it("requires strict runtime config in production", () => {
    expect(() => assertRuntimeConfig(getRuntimeConfig({
      APP_ENV: "production",
      DATABASE_URL: "postgresql://localhost:5432/paperasse",
    }))).toThrow("APP_ENV=production requires PUBLIC_APP_URL");

    expect(() => assertRuntimeConfig(getRuntimeConfig({
      APP_ENV: "production",
      PUBLIC_APP_URL: "https://app.paperasse.example",
      SESSION_SECRET: "12345678901234567890123456789012",
      COOKIE_SECURE: "true",
      DATABASE_URL: "postgresql://localhost:5432/paperasse",
      AUTH_MODE: "clerk",
      CLERK_PUBLISHABLE_KEY: "pk_live",
      CLERK_SECRET_KEY: "sk_live",
      CLERK_WEBHOOK_SECRET: "whsec_clerk",
      BILLING_MODE: "stripe",
      STRIPE_SECRET_KEY: "sk_live",
      STRIPE_WEBHOOK_SECRET: "whsec",
      STRIPE_PRICE_SOLO: "price_solo",
      STRIPE_PRICE_ENTREPRISE: "price_entreprise",
      STRIPE_PRICE_ENTREPRISE_PLUS: "price_plus",
      OBJECT_STORAGE_MODE: "s3",
      S3_ENDPOINT: "https://s3.example",
      S3_BUCKET_DOCUMENTS: "docs",
      S3_BUCKET_EVIDENCE: "evidence",
      S3_ACCESS_KEY_ID: "access",
      S3_SECRET_ACCESS_KEY: "secret",
    }))).not.toThrow();
  });

  it("supports mock and provider Open Banking configuration", () => {
    expect(() => assertRuntimeConfig(getRuntimeConfig({
      DATABASE_URL: "postgresql://localhost:5432/paperasse",
      OPEN_BANKING_PROVIDER: "mock",
    }))).not.toThrow();

    expect(() => assertRuntimeConfig(getRuntimeConfig({
      DATABASE_URL: "postgresql://localhost:5432/paperasse",
      OPEN_BANKING_PROVIDER: "bridge",
    }))).toThrow("OPEN_BANKING_CLIENT_ID");

    expect(() => assertRuntimeConfig(getRuntimeConfig({
      APP_ENV: "staging",
      DATABASE_URL: "postgresql://localhost:5432/paperasse",
      OPEN_BANKING_PROVIDER: "powens",
      OPEN_BANKING_CLIENT_ID: "client",
      OPEN_BANKING_CLIENT_SECRET: "secret",
      OPEN_BANKING_WEBHOOK_SECRET: "webhook",
      OPEN_BANKING_REDIRECT_URI: "https://app.example/api/open-banking/callback",
      OPEN_BANKING_BASE_URL: "https://paperasse.biapi.pro/2.0",
    }))).toThrow("PROVIDER_SECRET_ENCRYPTION_KEY");
  });
});

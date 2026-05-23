import type { CompanyWorkspace } from "../company-workspace/company-workspace.server";
import { assertFiscalYearMutable } from "../annual-closing/annual-closing-center.server";
import { getRuntimeConfig, sanitizedRuntimeConfig, type RuntimeConfig } from "../runtime-config.server";

export class SecurityHardeningCenter {
  constructor(private readonly config: RuntimeConfig = getRuntimeConfig()) {}

  getSecurityStatus() {
    const runtime = sanitizedRuntimeConfig(this.config);
    return {
      cookieSecure: this.config.cookieSecure,
      sessionSecretConfigured: Boolean(this.config.sessionSecret),
      productionStrict: this.config.appEnv === "production",
      secretsRedacted: true,
      runtime,
      checks: [
        { code: "session_secret", ok: this.config.appEnv !== "production" || Boolean(this.config.sessionSecret), label: "Session secret configuré" },
        { code: "secure_cookie", ok: this.config.appEnv !== "production" || this.config.cookieSecure, label: "Cookies secure en production" },
        { code: "auth_clerk", ok: this.config.appEnv !== "production" || this.config.authMode === "clerk", label: "Auth Clerk en production" },
        { code: "storage_s3", ok: this.config.appEnv !== "production" || this.config.objectStorageMode === "s3", label: "Stockage objet en production" },
        { code: "billing_stripe", ok: this.config.appEnv !== "production" || this.config.billingMode === "stripe", label: "Billing Stripe en production" },
        { code: "clerk_webhook_secret", ok: this.config.authMode !== "clerk" || Boolean(this.config.clerkWebhookSecret), label: "Webhook Clerk signé" },
        { code: "stripe_webhook_secret", ok: this.config.billingMode !== "stripe" || Boolean(this.config.stripeWebhookSecret), label: "Webhook Stripe signé" },
        { code: "open_banking_webhook_secret", ok: this.config.openBankingProvider === "disabled" || this.config.openBankingProvider === "mock" || this.config.openBankingProvider === "gocardless" || Boolean(this.config.openBankingWebhookSecret), label: "Webhook Open Banking signé" },
        { code: "provider_secret_vault", ok: this.config.appEnv === "local" || this.config.openBankingProvider === "disabled" || this.config.openBankingProvider === "mock" || this.config.openBankingProvider === "gocardless" || Boolean(this.config.providerSecretEncryptionKey), label: "Coffre secrets provider configuré" },
      ],
    };
  }

  async assertFiscalYearMutable(workspace: CompanyWorkspace) {
    return assertFiscalYearMutable(workspace);
  }

  redact(input: Record<string, unknown>) {
    return redactSensitive(input) as Record<string, unknown>;
  }
}

export function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key,
      /secret|token|password|key|authorization|iban/i.test(key) ? "[redacted]" : redactSensitive(item),
    ]));
  }
  if (typeof value !== "string") return value;
  return value
    .replace(/\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g, "[redacted-iban]")
    .replace(/(sk_(live|test)_[a-zA-Z0-9]+)/g, "[redacted-secret]")
    .replace(/(whsec_[a-zA-Z0-9_=-]+)/g, "[redacted-secret]")
    .replace(/(Bearer\s+)[A-Za-z0-9._=-]+/gi, "$1[redacted-token]");
}

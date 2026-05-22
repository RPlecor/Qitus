import { config } from "dotenv";

config({ quiet: true });

export type AuthMode = "dev" | "clerk";
export type AiProviderMode = "auto" | "fake" | "codex-cli" | "openai";
export type ImportExecutionMode = "inline" | "bullmq" | "auto";
export type BillingMode = "stub" | "stripe";
export type ChatProviderMode = "fake" | "codex-cli";
export type ConnectorsMode = "disabled" | "fixture" | "live";
export type AppEnvironment = "local" | "staging" | "production";
export type ObjectStorageMode = "local" | "s3";
export type ObservabilityMode = "disabled" | "local" | "sentry" | "otel";
export type CronMode = "disabled" | "local" | "worker";
export type OpenBankingProviderMode = "disabled" | "mock" | "bridge" | "powens" | "gocardless" | "tink" | "yapily";

export type RuntimeConfig = {
  appEnv: AppEnvironment;
  publicAppUrl: string | undefined;
  sessionSecret: string | undefined;
  cookieSecure: boolean;
  authMode: AuthMode;
  databaseUrl: string | undefined;
  aiProvider: AiProviderMode;
  codexCliBin: string;
  codexModel: string;
  openAiModel: string;
  openAiApiKey: string | undefined;
  clerkPublishableKey: string | undefined;
  clerkSecretKey: string | undefined;
  clerkWebhookSecret: string | undefined;
  paperasseRepoPath: string;
  documentStorageDir: string;
  evidenceStorageDir: string;
  objectStorageMode: ObjectStorageMode;
  s3Endpoint: string | undefined;
  s3Region: string;
  s3BucketDocuments: string | undefined;
  s3BucketEvidence: string | undefined;
  s3AccessKeyId: string | undefined;
  s3SecretAccessKey: string | undefined;
  enablePdfGeneration: boolean;
  importExecutionMode: ImportExecutionMode;
  redisUrl: string;
  observabilityMode: ObservabilityMode;
  sentryDsn: string | undefined;
  otelExporterOtlpEndpoint: string | undefined;
  cronMode: CronMode;
  workdirCleanupMaxAgeMinutes: number;
  billingMode: BillingMode;
  stripeSecretKey: string | undefined;
  stripeWebhookSecret: string | undefined;
  stripePriceSolo: string | undefined;
  stripePriceEntreprise: string | undefined;
  stripePriceEntreprisePlus: string | undefined;
  chatProvider: ChatProviderMode;
  chatModel: string;
  connectorsMode?: ConnectorsMode;
  qontoId?: string;
  qontoApiSecret?: string;
  stripeConnectorSecret?: string;
  openBankingProvider: OpenBankingProviderMode;
  openBankingClientId?: string;
  openBankingClientSecret?: string;
  openBankingWebhookSecret?: string;
  openBankingRedirectUri?: string;
  openBankingBaseUrl?: string;
  providerSecretEncryptionKey?: string;
};

export function getRuntimeConfig(env: Record<string, string | undefined> = process.env): RuntimeConfig {
  return {
    appEnv: parseAppEnvironment(env.APP_ENV),
    publicAppUrl: env.PUBLIC_APP_URL,
    sessionSecret: env.SESSION_SECRET,
    cookieSecure: env.COOKIE_SECURE ? env.COOKIE_SECURE === "1" || env.COOKIE_SECURE.toLowerCase() === "true" : parseAppEnvironment(env.APP_ENV) === "production",
    authMode: parseAuthMode(env.AUTH_MODE),
    databaseUrl: env.DATABASE_URL,
    aiProvider: parseAiProvider(env.AI_PROVIDER),
    codexCliBin: env.CODEX_CLI_BIN ?? "codex",
    codexModel: env.CODEX_MODEL ?? "gpt-5.4-mini",
    openAiModel: env.OPENAI_MODEL ?? "gpt-4o-mini",
    openAiApiKey: env.OPENAI_API_KEY,
    clerkPublishableKey: env.CLERK_PUBLISHABLE_KEY,
    clerkSecretKey: env.CLERK_SECRET_KEY,
    clerkWebhookSecret: env.CLERK_WEBHOOK_SECRET,
    paperasseRepoPath: env.QITUS_RUNTIME_REPO_PATH ?? env.PAPERASSE_REPO_PATH ?? "./vendor/paperasse",
    documentStorageDir: env.DOCUMENT_STORAGE_DIR ?? "storage/documents",
    evidenceStorageDir: env.EVIDENCE_STORAGE_DIR ?? "storage/evidence",
    objectStorageMode: parseObjectStorageMode(env.OBJECT_STORAGE_MODE),
    s3Endpoint: env.S3_ENDPOINT,
    s3Region: env.S3_REGION ?? "fr-par",
    s3BucketDocuments: env.S3_BUCKET_DOCUMENTS,
    s3BucketEvidence: env.S3_BUCKET_EVIDENCE,
    s3AccessKeyId: env.S3_ACCESS_KEY_ID,
    s3SecretAccessKey: env.S3_SECRET_ACCESS_KEY,
    enablePdfGeneration: env.ENABLE_PDF_GENERATION === "1",
    importExecutionMode: parseImportExecutionMode(env.IMPORT_EXECUTION_MODE),
    redisUrl: env.REDIS_URL ?? "redis://localhost:6379",
    observabilityMode: parseObservabilityMode(env.OBSERVABILITY_MODE),
    sentryDsn: env.SENTRY_DSN,
    otelExporterOtlpEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
    cronMode: parseCronMode(env.CRON_MODE),
    workdirCleanupMaxAgeMinutes: parsePositiveInt(env.WORKDIR_CLEANUP_MAX_AGE_MINUTES, 120),
    billingMode: parseBillingMode(env.BILLING_MODE),
    stripeSecretKey: env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET,
    stripePriceSolo: env.STRIPE_PRICE_SOLO,
    stripePriceEntreprise: env.STRIPE_PRICE_ENTREPRISE,
    stripePriceEntreprisePlus: env.STRIPE_PRICE_ENTREPRISE_PLUS,
    chatProvider: parseChatProvider(env.CHAT_PROVIDER),
    chatModel: env.CHAT_MODEL ?? env.CODEX_MODEL ?? "gpt-5.4-mini",
    connectorsMode: parseConnectorsMode(env.CONNECTORS_MODE),
    qontoId: env.QONTO_ID,
    qontoApiSecret: env.QONTO_API_SECRET,
    stripeConnectorSecret: env.STRIPE_SECRET,
    openBankingProvider: parseOpenBankingProvider(env.OPEN_BANKING_PROVIDER),
    openBankingClientId: env.OPEN_BANKING_CLIENT_ID,
    openBankingClientSecret: env.OPEN_BANKING_CLIENT_SECRET,
    openBankingWebhookSecret: env.OPEN_BANKING_WEBHOOK_SECRET,
    openBankingRedirectUri: env.OPEN_BANKING_REDIRECT_URI,
    openBankingBaseUrl: env.OPEN_BANKING_BASE_URL,
    providerSecretEncryptionKey: env.PROVIDER_SECRET_ENCRYPTION_KEY,
  };
}

export function assertRuntimeConfig(config = getRuntimeConfig()) {
  const errors: string[] = [];
  if (!config.databaseUrl) errors.push("DATABASE_URL is required.");
  if (config.appEnv === "production") {
    if (!config.publicAppUrl) errors.push("APP_ENV=production requires PUBLIC_APP_URL.");
    if (!config.sessionSecret || config.sessionSecret.length < 32) errors.push("APP_ENV=production requires SESSION_SECRET with at least 32 characters.");
    if (!config.cookieSecure) errors.push("APP_ENV=production requires COOKIE_SECURE=true.");
    if (config.authMode !== "clerk") errors.push("APP_ENV=production requires AUTH_MODE=clerk.");
    if (config.billingMode !== "stripe") errors.push("APP_ENV=production requires BILLING_MODE=stripe.");
    if (config.objectStorageMode !== "s3") errors.push("APP_ENV=production requires OBJECT_STORAGE_MODE=s3.");
  }
  if (config.aiProvider === "openai" && !config.openAiApiKey) errors.push("AI_PROVIDER=openai requires OPENAI_API_KEY.");
  if (config.importExecutionMode === "bullmq" && !config.redisUrl) errors.push("IMPORT_EXECUTION_MODE=bullmq requires REDIS_URL.");
  if (config.cronMode === "worker" && !config.redisUrl) errors.push("CRON_MODE=worker requires REDIS_URL.");
  if (config.objectStorageMode === "s3") {
    if (!config.s3Endpoint) errors.push("OBJECT_STORAGE_MODE=s3 requires S3_ENDPOINT.");
    if (!config.s3BucketDocuments) errors.push("OBJECT_STORAGE_MODE=s3 requires S3_BUCKET_DOCUMENTS.");
    if (!config.s3BucketEvidence) errors.push("OBJECT_STORAGE_MODE=s3 requires S3_BUCKET_EVIDENCE.");
    if (!config.s3AccessKeyId) errors.push("OBJECT_STORAGE_MODE=s3 requires S3_ACCESS_KEY_ID.");
    if (!config.s3SecretAccessKey) errors.push("OBJECT_STORAGE_MODE=s3 requires S3_SECRET_ACCESS_KEY.");
  }
  if (config.observabilityMode === "sentry" && !config.sentryDsn) errors.push("OBSERVABILITY_MODE=sentry requires SENTRY_DSN.");
  if (config.observabilityMode === "otel" && !config.otelExporterOtlpEndpoint) errors.push("OBSERVABILITY_MODE=otel requires OTEL_EXPORTER_OTLP_ENDPOINT.");
  if (config.billingMode === "stripe") {
    if (!config.stripeSecretKey) errors.push("BILLING_MODE=stripe requires STRIPE_SECRET_KEY.");
    if (!config.stripeWebhookSecret) errors.push("BILLING_MODE=stripe requires STRIPE_WEBHOOK_SECRET.");
    if (!config.stripePriceSolo) errors.push("BILLING_MODE=stripe requires STRIPE_PRICE_SOLO.");
    if (!config.stripePriceEntreprise) errors.push("BILLING_MODE=stripe requires STRIPE_PRICE_ENTREPRISE.");
    if (!config.stripePriceEntreprisePlus) errors.push("BILLING_MODE=stripe requires STRIPE_PRICE_ENTREPRISE_PLUS.");
  }
  if (config.authMode === "clerk") {
    if (!config.clerkPublishableKey) errors.push("AUTH_MODE=clerk requires CLERK_PUBLISHABLE_KEY.");
    if (!config.clerkSecretKey) errors.push("AUTH_MODE=clerk requires CLERK_SECRET_KEY.");
    if (!config.clerkWebhookSecret) errors.push("AUTH_MODE=clerk requires CLERK_WEBHOOK_SECRET.");
  }
  if ((config.connectorsMode ?? "disabled") === "live") {
    if (!config.qontoId || !config.qontoApiSecret) errors.push("CONNECTORS_MODE=live requires QONTO_ID and QONTO_API_SECRET for Qonto sync.");
    if (!config.stripeConnectorSecret) errors.push("CONNECTORS_MODE=live requires STRIPE_SECRET for Stripe sync.");
  }
  if (config.openBankingProvider !== "disabled" && config.openBankingProvider !== "mock") {
    if (!config.openBankingClientId) errors.push(`OPEN_BANKING_PROVIDER=${config.openBankingProvider} requires OPEN_BANKING_CLIENT_ID.`);
    if (!config.openBankingClientSecret) errors.push(`OPEN_BANKING_PROVIDER=${config.openBankingProvider} requires OPEN_BANKING_CLIENT_SECRET.`);
    if (config.openBankingProvider !== "gocardless" && !config.openBankingWebhookSecret) errors.push(`OPEN_BANKING_PROVIDER=${config.openBankingProvider} requires OPEN_BANKING_WEBHOOK_SECRET.`);
    if (!config.openBankingRedirectUri && !config.publicAppUrl) errors.push(`OPEN_BANKING_PROVIDER=${config.openBankingProvider} requires OPEN_BANKING_REDIRECT_URI or PUBLIC_APP_URL.`);
    if ((config.appEnv === "staging" || config.appEnv === "production") && (config.openBankingProvider === "bridge" || config.openBankingProvider === "powens") && !config.providerSecretEncryptionKey) {
      errors.push(`OPEN_BANKING_PROVIDER=${config.openBankingProvider} requires PROVIDER_SECRET_ENCRYPTION_KEY in ${config.appEnv}.`);
    }
  }
  if (errors.length > 0) throw new Error(errors.join(" "));
  return config;
}

export function sanitizedRuntimeConfig(config = getRuntimeConfig()) {
  return {
    appEnv: config.appEnv,
    publicAppUrl: config.publicAppUrl,
    cookieSecure: config.cookieSecure,
    authMode: config.authMode,
    aiProvider: config.aiProvider,
    importExecutionMode: config.importExecutionMode,
    billingMode: config.billingMode,
    chatProvider: config.chatProvider,
    connectorsMode: config.connectorsMode,
    objectStorageMode: config.objectStorageMode,
    observabilityMode: config.observabilityMode,
    cronMode: config.cronMode,
    openBankingProvider: config.openBankingProvider,
    enablePdfGeneration: config.enablePdfGeneration,
    hasDatabaseUrl: Boolean(config.databaseUrl),
    hasSessionSecret: Boolean(config.sessionSecret),
    hasClerkConfig: Boolean(config.clerkPublishableKey && config.clerkSecretKey && config.clerkWebhookSecret),
    hasStripeBillingConfig: Boolean(config.stripeSecretKey && config.stripeWebhookSecret),
    hasObjectStorageConfig: Boolean(config.s3Endpoint && config.s3BucketDocuments && config.s3BucketEvidence && config.s3AccessKeyId && config.s3SecretAccessKey),
    hasOpenBankingConfig: config.openBankingProvider === "mock" || (config.openBankingProvider === "gocardless"
      ? Boolean(config.openBankingClientId && config.openBankingClientSecret)
      : config.openBankingProvider === "powens"
        ? Boolean(config.openBankingBaseUrl && config.openBankingClientId && config.openBankingClientSecret && config.openBankingWebhookSecret && (config.appEnv === "local" || config.providerSecretEncryptionKey))
        : Boolean(config.openBankingClientId && config.openBankingClientSecret && config.openBankingWebhookSecret && (config.appEnv === "local" || config.providerSecretEncryptionKey))),
    hasProviderSecretVaultKey: Boolean(config.providerSecretEncryptionKey) || config.appEnv === "local",
  };
}

export function parseAppEnvironment(value: string | undefined): AppEnvironment {
  const mode = value?.toLowerCase() ?? "local";
  if (mode === "local" || mode === "staging" || mode === "production") return mode;
  throw new Error(`Unsupported APP_ENV value: ${value}`);
}

export function parseAuthMode(value: string | undefined): AuthMode {
  const mode = value?.toLowerCase() ?? "dev";
  if (mode === "dev" || mode === "clerk") return mode;
  throw new Error(`Unsupported AUTH_MODE value: ${value}`);
}

export function parseAiProvider(value: string | undefined): AiProviderMode {
  const mode = value?.toLowerCase() ?? "codex-cli";
  if (mode === "fake" || mode === "codex-cli" || mode === "openai" || mode === "auto") return mode;
  throw new Error(`Unsupported AI_PROVIDER value: ${value}`);
}

export function parseImportExecutionMode(value: string | undefined): ImportExecutionMode {
  const mode = value?.toLowerCase() ?? "inline";
  if (mode === "inline" || mode === "bullmq" || mode === "auto") return mode;
  throw new Error(`Unsupported IMPORT_EXECUTION_MODE value: ${value}`);
}

export function parseBillingMode(value: string | undefined): BillingMode {
  const mode = value?.toLowerCase() ?? "stub";
  if (mode === "stub" || mode === "stripe") return mode;
  throw new Error(`Unsupported BILLING_MODE value: ${value}`);
}

export function parseChatProvider(value: string | undefined): ChatProviderMode {
  const mode = value?.toLowerCase() ?? "codex-cli";
  if (mode === "fake" || mode === "codex-cli") return mode;
  throw new Error(`Unsupported CHAT_PROVIDER value: ${value}`);
}

export function parseConnectorsMode(value: string | undefined): ConnectorsMode {
  const mode = value?.toLowerCase() ?? "disabled";
  if (mode === "disabled" || mode === "fixture" || mode === "live") return mode;
  throw new Error(`Unsupported CONNECTORS_MODE value: ${value}`);
}

export function parseObjectStorageMode(value: string | undefined): ObjectStorageMode {
  const mode = value?.toLowerCase() ?? "local";
  if (mode === "local" || mode === "s3") return mode;
  throw new Error(`Unsupported OBJECT_STORAGE_MODE value: ${value}`);
}

export function parseObservabilityMode(value: string | undefined): ObservabilityMode {
  const mode = value?.toLowerCase() ?? "local";
  if (mode === "disabled" || mode === "local" || mode === "sentry" || mode === "otel") return mode;
  throw new Error(`Unsupported OBSERVABILITY_MODE value: ${value}`);
}

export function parseCronMode(value: string | undefined): CronMode {
  const mode = value?.toLowerCase() ?? "disabled";
  if (mode === "disabled" || mode === "local" || mode === "worker") return mode;
  throw new Error(`Unsupported CRON_MODE value: ${value}`);
}

export function parseOpenBankingProvider(value: string | undefined): OpenBankingProviderMode {
  const mode = value?.toLowerCase() ?? "disabled";
  if (mode === "disabled" || mode === "mock" || mode === "bridge" || mode === "powens" || mode === "gocardless" || mode === "tink" || mode === "yapily") return mode;
  throw new Error(`Unsupported OPEN_BANKING_PROVIDER value: ${value}`);
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

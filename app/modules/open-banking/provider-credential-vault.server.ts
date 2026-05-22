import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { ExpectedRouteError } from "../route-errors.server";
import { getRuntimeConfig, type RuntimeConfig } from "../runtime-config.server";

export interface ProviderCredentialVault {
  putSecret(key: string, value: string): Promise<void>;
  getSecret(key: string): Promise<string | null>;
  deleteSecret(key: string): Promise<void>;
  hasSecret(key: string): Promise<boolean>;
}

export class LocalEncryptedProviderCredentialVault implements ProviderCredentialVault {
  constructor(
    private readonly config: RuntimeConfig = getRuntimeConfig(),
    private readonly rootDir = "storage/provider-credentials"
  ) {}

  async putSecret(key: string, value: string) {
    await mkdir(this.rootDir, { recursive: true });
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const payload = {
      version: 1,
      iv: iv.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
      value: encrypted.toString("base64"),
    };
    await writeFile(this.filePath(key), JSON.stringify(payload), "utf8");
  }

  async getSecret(key: string) {
    try {
      const raw = await readFile(this.filePath(key), "utf8");
      const payload = JSON.parse(raw) as { iv: string; tag: string; value: string };
      const decipher = createDecipheriv("aes-256-gcm", this.encryptionKey(), Buffer.from(payload.iv, "base64"));
      decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
      return Buffer.concat([decipher.update(Buffer.from(payload.value, "base64")), decipher.final()]).toString("utf8");
    } catch (error) {
      if (isNotFound(error)) return null;
      throw new ExpectedRouteError("Secret provider illisible : vérifie PROVIDER_SECRET_ENCRYPTION_KEY.", 500);
    }
  }

  async deleteSecret(key: string) {
    await rm(this.filePath(key), { force: true });
  }

  async hasSecret(key: string) {
    return (await this.getSecret(key)) !== null;
  }

  private encryptionKey() {
    const configured = this.config.providerSecretEncryptionKey;
    if (!configured && (this.config.appEnv === "staging" || this.config.appEnv === "production")) {
      throw new ExpectedRouteError("PROVIDER_SECRET_ENCRYPTION_KEY est requis pour stocker les tokens provider.", 500);
    }
    return createHash("sha256").update(configured ?? "qitus-local-provider-secret-key").digest();
  }

  private filePath(key: string) {
    const digest = createHash("sha256").update(key).digest("hex");
    return path.join(this.rootDir, `${digest}.json`);
  }
}

export function providerSecretKey(provider: string, companyId: string, providerUserId: string) {
  return `${provider}:${companyId}:${providerUserId}`;
}

function isNotFound(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

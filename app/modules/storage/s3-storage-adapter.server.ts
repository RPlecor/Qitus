import { createHash, createHmac } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { getRuntimeConfig, type RuntimeConfig } from "../runtime-config.server";

type S3RequestInput = {
  method: "GET" | "PUT" | "HEAD" | "DELETE";
  bucket: string;
  key: string;
  body?: Buffer;
};

export type S3StorageConfig = Pick<
  RuntimeConfig,
  "s3Endpoint" | "s3Region" | "s3AccessKeyId" | "s3SecretAccessKey"
>;

export class S3StorageAdapter {
  constructor(private readonly config: S3StorageConfig = getRuntimeConfig()) {}

  async putFile(sourcePath: string, bucket: string, key: string) {
    const body = await readFile(sourcePath);
    await this.request({ method: "PUT", bucket, key, body });
    const stats = await stat(sourcePath);
    return { key, sizeBytes: stats.size };
  }

  async putBytes(body: Buffer, bucket: string, key: string) {
    await this.request({ method: "PUT", bucket, key, body });
    return { key, sizeBytes: body.byteLength };
  }

  async get(bucket: string, key: string) {
    const response = await this.request({ method: "GET", bucket, key });
    const body = Buffer.from(await response.arrayBuffer());
    return { body, sizeBytes: body.byteLength };
  }

  async delete(bucket: string, key: string) {
    await this.request({ method: "DELETE", bucket, key });
  }

  async exists(bucket: string, key: string) {
    const response = await this.request({ method: "HEAD", bucket, key }, true);
    if (response.status === 404) return false;
    if (!response.ok) throw new Error(`Object storage HEAD failed: HTTP ${response.status}`);
    return true;
  }

  private async request(input: S3RequestInput, allowNotFound = false) {
    const endpoint = required(this.config.s3Endpoint, "S3_ENDPOINT");
    const accessKey = required(this.config.s3AccessKeyId, "S3_ACCESS_KEY_ID");
    const secretKey = required(this.config.s3SecretAccessKey, "S3_SECRET_ACCESS_KEY");
    const region = this.config.s3Region || "fr-par";
    const now = new Date();
    const amzDate = timestamp(now);
    const dateStamp = amzDate.slice(0, 8);
    const encodedKey = input.key.split("/").map(encodeURIComponent).join("/");
    const base = endpoint.replace(/\/+$/, "");
    const url = new URL(`${base}/${input.bucket}/${encodedKey}`);
    const body = input.body ?? Buffer.alloc(0);
    const payloadHash = sha256(body);
    const headers: Record<string, string> = {
      host: url.host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    };
    const signedHeaders = Object.keys(headers).sort().join(";");
    const canonicalHeaders = Object.keys(headers).sort().map((name) => `${name}:${headers[name]}\n`).join("");
    const canonicalRequest = [
      input.method,
      url.pathname,
      url.searchParams.toString(),
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join("\n");
    const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
    const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, sha256(canonicalRequest)].join("\n");
    const signature = hmac(signingKey(secretKey, dateStamp, region), stringToSign, "hex");
    headers.authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const response = await fetch(url, {
      method: input.method,
      headers,
      body: input.method === "PUT" ? new Uint8Array(body) : undefined,
    });
    if (!response.ok && !(allowNotFound && response.status === 404)) {
      const message = await response.text().catch(() => "");
      throw new Error(`Object storage ${input.method} failed: HTTP ${response.status}${message ? ` ${message.slice(0, 180)}` : ""}`);
    }
    return response;
  }
}

function required(value: string | undefined, name: string) {
  if (!value) throw new Error(`OBJECT_STORAGE_MODE=s3 requires ${name}.`);
  return value;
}

function sha256(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: Buffer | string, value: string, encoding?: "hex") {
  return createHmac("sha256", key).update(value).digest(encoding as never) as string;
}

function signingKey(secret: string, date: string, region: string) {
  const kDate = createHmac("sha256", `AWS4${secret}`).update(date).digest();
  const kRegion = createHmac("sha256", kDate).update(region).digest();
  const kService = createHmac("sha256", kRegion).update("s3").digest();
  return createHmac("sha256", kService).update("aws4_request").digest();
}

function timestamp(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

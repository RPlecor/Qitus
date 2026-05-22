import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { getRuntimeConfig, type RuntimeConfig } from "../runtime-config.server";
import { S3StorageAdapter } from "../storage/s3-storage-adapter.server";

export type StoredEvidenceBytes = {
  body: Buffer;
  sizeBytes: number;
};

export interface EvidenceStorageAdapter {
  put(bytes: Buffer, key: string): Promise<{ key: string; sizeBytes: number }>;
  get(key: string): Promise<StoredEvidenceBytes>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

export class LocalEvidenceStorageAdapter implements EvidenceStorageAdapter {
  constructor(private readonly root = process.env.EVIDENCE_STORAGE_DIR ?? path.join(process.cwd(), "storage", "evidence")) {}

  async put(bytes: Buffer, key: string) {
    const destination = this.pathFor(key);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, bytes);
    const stats = await stat(destination);
    return { key, sizeBytes: stats.size };
  }

  async get(key: string): Promise<StoredEvidenceBytes> {
    const body = await readFile(this.pathFor(key));
    return { body, sizeBytes: body.byteLength };
  }

  async delete(key: string) {
    await rm(this.pathFor(key), { force: true }).catch(() => undefined);
  }

  async exists(key: string) {
    try {
      await stat(this.pathFor(key));
      return true;
    } catch {
      return false;
    }
  }

  private pathFor(key: string) {
    return path.join(this.root, key);
  }
}

export class ObjectEvidenceStorageAdapter implements EvidenceStorageAdapter {
  constructor(
    private readonly config: RuntimeConfig = getRuntimeConfig(),
    private readonly s3 = new S3StorageAdapter(config)
  ) {}

  async put(bytes: Buffer, key: string): Promise<{ key: string; sizeBytes: number }> {
    return this.s3.putBytes(bytes, this.bucket(), key);
  }

  async get(key: string): Promise<StoredEvidenceBytes> {
    return this.s3.get(this.bucket(), key);
  }

  async delete(key: string): Promise<void> {
    await this.s3.delete(this.bucket(), key);
  }

  async exists(key: string): Promise<boolean> {
    return this.s3.exists(this.bucket(), key);
  }

  private bucket() {
    if (!this.config.s3BucketEvidence) throw new Error("OBJECT_STORAGE_MODE=s3 requires S3_BUCKET_EVIDENCE.");
    return this.config.s3BucketEvidence;
  }
}

export function createEvidenceStorageAdapter(config: RuntimeConfig = getRuntimeConfig()): EvidenceStorageAdapter {
  return config.objectStorageMode === "s3"
    ? new ObjectEvidenceStorageAdapter(config)
    : new LocalEvidenceStorageAdapter(config.evidenceStorageDir);
}

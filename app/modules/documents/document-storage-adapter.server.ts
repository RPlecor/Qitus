import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { S3StorageAdapter } from "../storage/s3-storage-adapter.server";
import { getRuntimeConfig, type RuntimeConfig } from "../runtime-config.server";

export type StoredDocumentBytes = {
  body: Buffer;
  sizeBytes: number;
};

export interface DocumentStorageAdapter {
  put(sourcePath: string, key: string): Promise<{ key: string; sizeBytes: number }>;
  get(key: string): Promise<StoredDocumentBytes>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

export class LocalDocumentStorageAdapter implements DocumentStorageAdapter {
  constructor(private readonly root = process.env.DOCUMENT_STORAGE_DIR ?? path.join(process.cwd(), "storage", "documents")) {}

  async put(sourcePath: string, key: string) {
    const destination = this.pathFor(key);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, await readFile(sourcePath));
    const stats = await stat(destination);
    return { key, sizeBytes: stats.size };
  }

  async get(key: string): Promise<StoredDocumentBytes> {
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

export class ObjectStorageDocumentStorageAdapter implements DocumentStorageAdapter {
  constructor(
    private readonly config: RuntimeConfig = getRuntimeConfig(),
    private readonly s3 = new S3StorageAdapter(config)
  ) {}

  async put(sourcePath: string, key: string): Promise<{ key: string; sizeBytes: number }> {
    return this.s3.putFile(sourcePath, this.bucket(), key);
  }

  async get(key: string): Promise<StoredDocumentBytes> {
    return this.s3.get(this.bucket(), key);
  }

  async delete(key: string): Promise<void> {
    await this.s3.delete(this.bucket(), key);
  }

  async exists(key: string): Promise<boolean> {
    return this.s3.exists(this.bucket(), key);
  }

  private bucket() {
    if (!this.config.s3BucketDocuments) throw new Error("OBJECT_STORAGE_MODE=s3 requires S3_BUCKET_DOCUMENTS.");
    return this.config.s3BucketDocuments;
  }
}

export function createDocumentStorageAdapter(config: RuntimeConfig = getRuntimeConfig()): DocumentStorageAdapter {
  return config.objectStorageMode === "s3"
    ? new ObjectStorageDocumentStorageAdapter(config)
    : new LocalDocumentStorageAdapter(config.documentStorageDir);
}

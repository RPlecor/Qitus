import { createDocumentStorageAdapter } from "../documents/document-storage-adapter.server";
import { createEvidenceStorageAdapter } from "../evidence/evidence-storage-adapter.server";
import { getRuntimeConfig, type RuntimeConfig } from "../runtime-config.server";

export class StorageConfigurationCenter {
  constructor(private readonly config: RuntimeConfig = getRuntimeConfig()) {}

  getStatus() {
    const configured = this.config.objectStorageMode === "local" || Boolean(
      this.config.s3Endpoint &&
      this.config.s3BucketDocuments &&
      this.config.s3BucketEvidence &&
      this.config.s3AccessKeyId &&
      this.config.s3SecretAccessKey
    );
    return {
      mode: this.config.objectStorageMode,
      configured,
      documents: {
        adapter: this.config.objectStorageMode,
        bucket: this.config.objectStorageMode === "s3" ? this.config.s3BucketDocuments : null,
        root: this.config.objectStorageMode === "local" ? this.config.documentStorageDir : null,
      },
      evidence: {
        adapter: this.config.objectStorageMode,
        bucket: this.config.objectStorageMode === "s3" ? this.config.s3BucketEvidence : null,
        root: this.config.objectStorageMode === "local" ? this.config.evidenceStorageDir : null,
      },
    };
  }

  assertConfigured() {
    createDocumentStorageAdapter(this.config);
    createEvidenceStorageAdapter(this.config);
    return this.getStatus();
  }
}

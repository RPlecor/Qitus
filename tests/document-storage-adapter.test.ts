import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LocalDocumentStorageAdapter } from "../app/modules/documents/document-storage-adapter.server";

describe("DocumentStorageAdapter", () => {
  it("stores, reads, checks and deletes a local document", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "paperasse-docs-"));
    const source = path.join(root, "source.txt");
    await writeFile(source, "JournalCode");
    const storage = new LocalDocumentStorageAdapter(path.join(root, "storage"));

    const result = await storage.put(source, "company/fy/fec.txt");
    expect(result.sizeBytes).toBe("JournalCode".length);
    await expect(storage.exists(result.key)).resolves.toBe(true);
    await expect(storage.get(result.key)).resolves.toMatchObject({ sizeBytes: "JournalCode".length });
    await storage.delete(result.key);
    await expect(storage.exists(result.key)).resolves.toBe(false);
  });
});

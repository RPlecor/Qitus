import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LocalEvidenceStorageAdapter } from "../app/modules/evidence/evidence-storage-adapter.server";

describe("LocalEvidenceStorageAdapter", () => {
  it("puts, gets, checks and deletes evidence bytes", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "qitus-evidence-"));
    const storage = new LocalEvidenceStorageAdapter(root);
    try {
      const stored = await storage.put(Buffer.from("facture"), "company/fy/facture.txt");
      expect(stored.sizeBytes).toBe(7);
      expect(await storage.exists(stored.key)).toBe(true);
      expect((await storage.get(stored.key)).body.toString("utf8")).toBe("facture");
      await storage.delete(stored.key);
      expect(await storage.exists(stored.key)).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

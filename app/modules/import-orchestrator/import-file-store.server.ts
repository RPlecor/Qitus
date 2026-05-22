import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CsvImportUpload } from "./import-orchestrator.server";

export class ImportFileStore {
  async storeCSV(importId: string, file: CsvImportUpload) {
    const dir = path.join(process.cwd(), "storage", "imports");
    await mkdir(dir, { recursive: true });
    const filename = `${importId}-${randomUUID()}-${safeFilename(file.filename)}`;
    const storageKey = path.join("storage", "imports", filename);
    await writeFile(this.resolveStorageKey(storageKey), file.content, "utf8");
    return storageKey;
  }

  async readCSV(storageKey: string | null) {
    return readFile(this.resolveStorageKey(storageKey), "utf8");
  }

  resolveStorageKey(storageKey: string | null) {
    if (!storageKey) throw new Error("Fichier CSV introuvable pour cet import.");
    return path.isAbsolute(storageKey) ? storageKey : path.join(process.cwd(), storageKey);
  }
}

function safeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+/, "") || "import.csv";
}

import { describe, expect, it } from "vitest";
import {
  attachmentStatusLabel,
  documentFreshnessStatusLabel,
  importStepLabel,
  sanitizeUserFacingText,
  userFacingAction,
  userFacingLabel,
} from "../app/modules/product-language/product-language";

describe("ProductLanguageCenter", () => {
  it("exposes clear attachment reading labels", () => {
    expect(attachmentStatusLabel("EXTRACTED")).toBe("Lecture terminée");
    expect(attachmentStatusLabel("EXTRACTION_FAILED")).toBe("Lecture à vérifier");
    expect(userFacingLabel("attachment.extraction_review")).toBe("pièce à relire");
  });

  it("exposes clear document freshness labels", () => {
    expect(documentFreshnessStatusLabel("stale")).toBe("À mettre à jour");
    expect(documentFreshnessStatusLabel("superseded")).toBe("Remplacé");
  });

  it("exposes clear import labels", () => {
    expect(importStepLabel("detect-and-parse")).toBe("Lecture du fichier");
    expect(userFacingAction("import.mapping")).toBe("Associer les colonnes");
  });

  it("sanitizes internal vocabulary before display", () => {
    const sanitized = sanitizeUserFacingText("OCR extraction failed after stale manifest sync from provider adapter");
    expect(sanitized).not.toMatch(/\b(OCR|extraction|stale|manifest|sync|provider|adapter)\b/i);
    expect(sanitized).toContain("lecture de pièce");
    expect(sanitized).toContain("inventaire du dossier");
    expect(sanitized).toContain("connecteur");
  });
});

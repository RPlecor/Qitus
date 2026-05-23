import { describe, expect, it } from "vitest";
import { QitusKnowledgeCenter } from "../app/modules/chat/qitus-knowledge-center.server";
import { QitusUserGuideCenter, REQUIRED_USER_GUIDE_SURFACES } from "../app/modules/chat/qitus-user-guide-center.server";

describe("Qitus user guide knowledge", () => {
  it("covers every main product surface", () => {
    const center = new QitusUserGuideCenter();

    expect(center.validateGuideCoverage()).toEqual([]);
    expect(center.validateUserFacingLanguage()).toEqual([]);
    for (const surface of REQUIRED_USER_GUIDE_SURFACES) {
      expect(center.getSectionBySurface(surface)?.content).toContain("### Actions disponibles");
    }
  });

  it("builds stable knowledge chunks from the canonical guide", () => {
    const sources = new QitusUserGuideCenter().buildKnowledgeSources();

    expect(sources.length).toBeGreaterThan(10);
    expect(sources.every((source) => source.sourceId && source.title && source.content && source.surface && source.audience === "user")).toBe(true);
  });

  it("retrieves Imports, TVA, Documents, Clôture and Connecteurs from user questions", () => {
    const center = new QitusKnowledgeCenter();

    expect(center.search("Pourquoi mon import est en revue ?", { limit: 3 }).map((source) => source.surface)).toContain("imports");
    expect(center.search("Pourquoi ma TVA est à zéro ?", { limit: 3 }).map((source) => source.surface)).toContain("tva");
    expect(center.search("Comment régénérer mes documents ?", { limit: 3 }).map((source) => source.surface)).toContain("documents");
    expect(center.search("Pourquoi la clôture est bloquée ?", { limit: 3 }).map((source) => source.surface)).toContain("cloture");
    expect(center.search("Comment configurer Qonto bancaire ?", { limit: 3 }).map((source) => source.surface)).toContain("connecteurs");
  });
});

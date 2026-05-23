import { describe, expect, it } from "vitest";
import { ChatIntentPolicy } from "../app/modules/chat/chat-intent-policy.server";

describe("ChatIntentPolicy", () => {
  const references = [
    { code: "imports", label: "Imports", href: "/imports", reason: "Test" },
    { code: "documents", label: "Documents", href: "/documents", reason: "Test" },
    { code: "controle", label: "Contrôle", href: "/controle", reason: "Test" },
  ];

  it("treats CSV import help questions as navigation help", () => {
    expect(new ChatIntentPolicy().evaluateMessage("Où importer un CSV ?", references)).toMatchObject({
      allowed: true,
      intent: "navigation_help",
    });
  });

  it("treats how-to import questions as how-to help", () => {
    expect(new ChatIntentPolicy().evaluateMessage("Comment importer un CSV ?", references)).toMatchObject({
      allowed: true,
      intent: "how_to",
    });
  });

  it("blocks direct import commands as mutation requests", () => {
    expect(new ChatIntentPolicy().evaluateMessage("Importe ce CSV", references)).toMatchObject({
      allowed: false,
      intent: "mutation_request",
      matchedIntent: "import_file",
      suggestedReferences: [{ code: "imports", label: "Imports", href: "/imports", reason: "Test" }],
    });
  });

  it("keeps evidence attachment questions allowed", () => {
    expect(new ChatIntentPolicy().evaluateMessage("Où rattacher un justificatif ?", references)).toMatchObject({
      allowed: true,
      intent: "navigation_help",
    });
  });

  it("blocks direct FEC generation commands", () => {
    expect(new ChatIntentPolicy().evaluateMessage("Génère mon FEC", references)).toMatchObject({
      allowed: false,
      intent: "mutation_request",
      matchedIntent: "generate_document",
    });
  });

  it("refuses general accounting rule questions", () => {
    expect(new ChatIntentPolicy().evaluateMessage("Quel compte PCG utiliser ?", references)).toMatchObject({
      allowed: false,
      intent: "accounting_rules_v2",
      matchedIntent: "accounting_rules_v2",
    });
  });
});

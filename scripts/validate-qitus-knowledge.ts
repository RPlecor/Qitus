import { readFileSync } from "node:fs";
import { buildGeneratedModule, parseGuideSections, readCanonicalGuide, validateGuide } from "./qitus-guide-utils";

const outputPath = "app/modules/chat/qitus-knowledge.generated.ts";
const markdown = readCanonicalGuide();
const sections = parseGuideSections(markdown);
const issues = validateGuide(markdown, sections);
if (issues.length > 0) {
  throw new Error(`Guide Qitus invalide:\n- ${issues.join("\n- ")}`);
}

const expected = buildGeneratedModule(sections);
const current = readFileSync(outputPath, "utf8");
if (current !== expected) {
  throw new Error(`La base chatbot générée est obsolète. Lancez npm run generate:qitus-knowledge puis commitez ${outputPath}.`);
}

console.log(`✓ Guide Qitus canonique valide (${sections.length} sections).`);

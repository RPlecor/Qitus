import { writeFileSync } from "node:fs";
import { buildGeneratedModule, parseGuideSections, readCanonicalGuide, validateGuide } from "./qitus-guide-utils";

const outputPath = "app/modules/chat/qitus-knowledge.generated.ts";
const markdown = readCanonicalGuide();
const sections = parseGuideSections(markdown);
const issues = validateGuide(markdown, sections);
if (issues.length > 0) {
  throw new Error(`Guide Qitus invalide:\n- ${issues.join("\n- ")}`);
}

writeFileSync(outputPath, buildGeneratedModule(sections));
console.log(`Generated ${sections.length} Qitus knowledge sections in ${outputPath}`);

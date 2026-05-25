import { readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { readdirSync, statSync } from "node:fs";

const root = process.cwd();
const scannedRoots = ["app/modules", "app/routes", "scripts"];
const allowedPathParts = [
  "app/modules/official-references/",
  "app/modules/accounting-reference/",
  "scripts/validate-reference-consumers.ts",
  "scripts/bootstrap-official-references.ts",
];

const forbiddenPatterns = [
  { label: "ancien compte d'amortissement direct", pattern: /["']28183["']/ },
  { label: "liste TVA locale", pattern: /VAT_ACCOUNTS\s*=/ },
  { label: "compte TVA direct", pattern: /["']445(?:66|71|2|51|67)["']/ },
  { label: "tolérance de rapprochement directe", pattern: /<\s*0\.01|<=\s*0\.01|>\s*0\.01|>=\s*0\.01/ },
  { label: "liasse 2033 forcée", pattern: /Générer un brouillon local de liasse 2033|liasse-fiscale-2033\.md/ },
  { label: "lecture runtime synchrone de référentiel", pattern: /\.validateReferencePack\(|\.assertReferenceReady\(|\.getReferenceReadiness\(/ },
  { label: "bootstrap référentiel embarqué hors workflow", pattern: /buildOfficialReferencePacks\(/ },
  { label: "lecture directe de référentiel TVA sans await", pattern: /(?<!await )new VatReferenceCenter\(\)\.get(?:VatAccounts|VatAccountCodes|VatAccountLabels|Tolerances|Regime|LedgerReference)\(/ },
];

const files = scannedRoots.flatMap((dir) => walk(join(root, dir)))
  .filter((file) => /\.(ts|tsx)$/.test(file))
  .filter((file) => !allowedPathParts.some((part) => normalize(relative(root, file)).includes(part)));

const violations: string[] = [];
for (const file of files) {
  const content = await readFile(file, "utf8");
  const rel = normalize(relative(root, file));
  for (const { label, pattern } of forbiddenPatterns) {
    if (pattern.test(content)) violations.push(`${rel}: ${label}`);
  }
}

if (violations.length > 0) {
  console.error("Des constantes comptables critiques restent hors référentiels Qitus :");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(`OK ${files.length} fichiers vérifiés : les consommateurs critiques passent par les référentiels Qitus.`);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return full;
  });
}

function normalize(path: string) {
  return path.split("\\").join("/");
}

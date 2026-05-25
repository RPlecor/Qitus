import { OfficialReferenceCenter } from "../app/modules/official-references/official-reference-center.server";
import { isOfficialReferenceKind } from "../app/modules/official-references/official-reference-data.server";
import { OFFICIAL_REFERENCE_KINDS, type OfficialReferenceKind } from "../app/modules/official-references/official-reference-types";

const requested = process.argv[2];
const kinds: OfficialReferenceKind[] = requested
  ? isOfficialReferenceKind(requested) ? [requested] : fail(`Référentiel inconnu: ${requested}`)
  : [...OFFICIAL_REFERENCE_KINDS];

const center = new OfficialReferenceCenter();
await center.bootstrapEmbeddedReferences();
const results = await Promise.all(kinds.map((kind) => center.validateReferencePackAsync(kind)));
const failed = results.filter((result) => !result.ok);

for (const result of results) {
  const status = result.ok ? "OK" : "KO";
  const details = result.errors.length > 0 ? ` — ${result.errors.join("; ")}` : "";
  console.log(`${status} ${result.label} ${result.version}${details}`);
  for (const warning of result.warnings) console.log(`WARN ${result.label}: ${warning}`);
}

if (failed.length > 0) {
  console.error(`Official references validation failed: ${failed.map((item) => item.kind).join(", ")}`);
  process.exit(1);
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

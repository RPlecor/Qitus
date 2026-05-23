import { OfficialReferenceCenter } from "../app/modules/official-references/official-reference-center.server";
import { isOfficialReferenceKind } from "../app/modules/official-references/official-reference-data.server";
import { OFFICIAL_REFERENCE_KINDS, type OfficialReferenceKind } from "../app/modules/official-references/official-reference-types";

const requested = process.argv[2];
const center = new OfficialReferenceCenter();

const result = requested
  ? isOfficialReferenceKind(requested)
    ? await center.syncReference(requested as OfficialReferenceKind)
    : fail(`Référentiel inconnu: ${requested}`)
  : await center.syncAllOfficialReferences();

console.log(JSON.stringify(result, null, 2));

if (!requested) {
  const readiness = center.getReferenceReadiness();
  if (readiness.status === "blocked") {
    console.error("Un ou plusieurs référentiels restent bloqués après synchronisation.");
    process.exit(1);
  }
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

void OFFICIAL_REFERENCE_KINDS;

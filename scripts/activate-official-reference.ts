import { OfficialReferenceCenter } from "../app/modules/official-references/official-reference-center.server";
import { isOfficialReferenceKind } from "../app/modules/official-references/official-reference-data.server";

const kind = process.argv[2];
const version = process.argv[3];

if (!isOfficialReferenceKind(kind)) fail("Usage: tsx scripts/activate-official-reference.ts <kind> <version>");
if (!version) fail("Version de référentiel manquante.");

const result = await new OfficialReferenceCenter().activateReferencePack(kind, version);
console.log(JSON.stringify(result, null, 2));

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

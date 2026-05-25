import { OfficialReferenceCenter } from "../app/modules/official-references/official-reference-center.server";

async function main() {
  const result = await new OfficialReferenceCenter().bootstrapEmbeddedReferences();
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

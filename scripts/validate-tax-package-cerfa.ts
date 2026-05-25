import { OfficialReferenceCenter } from "../app/modules/official-references/official-reference-center.server";
import type { TaxPackageReferencePayload } from "../app/modules/official-references/official-reference-data.server";
import type { TaxPackageKind } from "../app/modules/official-references/tax-package-reference-center.server";

const EXPECTED: Record<TaxPackageKind, { minCases: number; tables: string[] }> = {
  tax_package_2033: { minCases: 55, tables: ["2033-A", "2033-B", "2033-C", "2033-D", "2033-E", "2033-F", "2033-G"] },
  tax_package_2050: { minCases: 80, tables: ["2050", "2051", "2052", "2053", "2054", "2055", "2056", "2057", "2058-A", "2058-B", "2058-C"] },
};

const center = new OfficialReferenceCenter();
await center.bootstrapEmbeddedReferences();

const failures: string[] = [];
for (const kind of Object.keys(EXPECTED) as TaxPackageKind[]) {
  const pack = await center.getActiveReferenceAsync<TaxPackageReferencePayload>(kind);
  const payload = pack.payloadJson;
  const expected = EXPECTED[kind];
  if (!payload.packageCode) failures.push(`${kind}: code formulaire absent`);
  if (!payload.label) failures.push(`${kind}: libellé absent`);
  if (payload.cases.length < expected.minCases) failures.push(`${kind}: ${payload.cases.length} cases, minimum attendu ${expected.minCases}`);
  for (const table of expected.tables) {
    if (!payload.tables.includes(table as never)) failures.push(`${kind}: tableau ${table} absent`);
    if (!payload.cases.some((taxCase) => taxCase.table === table)) failures.push(`${kind}: aucune case pour ${table}`);
  }
  const seen = new Set<string>();
  for (const taxCase of payload.cases) {
    if (seen.has(taxCase.code)) failures.push(`${kind}: case dupliquée ${taxCase.code}`);
    seen.add(taxCase.code);
    if (!taxCase.code) failures.push(`${kind}: case sans code`);
    if (!taxCase.label) failures.push(`${kind}: case ${taxCase.code} sans libellé`);
    if (!taxCase.table) failures.push(`${kind}: case ${taxCase.code} sans tableau`);
    if (!payload.tables.includes(taxCase.table as never)) failures.push(`${kind}: case ${taxCase.code} rattachée à un tableau inconnu ${taxCase.table}`);
    if (!taxCase.type) failures.push(`${kind}: case ${taxCase.code} sans type`);
    if (!taxCase.requiredSource) failures.push(`${kind}: case ${taxCase.code} sans source attendue`);
    if (!taxCase.emptyBehavior) failures.push(`${kind}: case ${taxCase.code} sans comportement d'absence`);
    if (!taxCase.calculationFamily) failures.push(`${kind}: case ${taxCase.code} sans famille de calcul`);
  }
  console.log(`OK ${payload.label} ${pack.version}: ${payload.cases.length} cases, ${payload.tables.length} tableaux`);
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

import { qitusVendorMappingDefinitions } from "../app/modules/accounting-rules/vendor-mapping-definitions";
import { ChartOfAccountsCenter } from "../app/modules/accounting-reference/chart-of-accounts-center.server";

const chart = new ChartOfAccountsCenter();
const integrity = chart.validateChartIntegrity();
const mappingIssues = qitusVendorMappingDefinitions.flatMap(([pattern, , accountDebit]) => {
  const debitOk = chart.isPostableAccount(accountDebit);
  const creditOk = chart.isPostableAccount("5121");
  return [
    debitOk ? null : `${pattern}: compte ${accountDebit} absent ou non utilisable`,
    creditOk ? null : `${pattern}: compte 5121 absent ou non utilisable`,
  ].filter((issue): issue is string => Boolean(issue));
});

if (!integrity.ok || mappingIssues.length > 0) {
  console.error(JSON.stringify({ integrity, mappingIssues }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  version: integrity.version,
  accountCount: integrity.accountCount,
  sourceUrl: integrity.sourceUrl,
  sourceChecksum: integrity.sourceChecksum,
  vendorMappingsChecked: qitusVendorMappingDefinitions.length,
}, null, 2));

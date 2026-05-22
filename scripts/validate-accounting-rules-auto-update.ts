import { AccountingRulePackCenter } from "../app/modules/accounting-rules/accounting-rule-pack-center.server";
import { RegulatorySourceCenter } from "../app/modules/accounting-rules/regulatory-source-center.server";
import { RuleApplicationWorkflow } from "../app/modules/accounting-rules/rule-application-workflow.server";
import { getDevCompanyWorkspace } from "../app/modules/company-workspace/company-workspace.server";

async function main() {
  const workspace = await getDevCompanyWorkspace();
  const packs = new AccountingRulePackCenter();
  const pack = await packs.syncSeedRulePack();
  const activePack = await packs.getActiveRulePack();
  if (!activePack) throw new Error("No active accounting rule pack.");

  const workflow = new RuleApplicationWorkflow();
  const application = await workflow.applyActiveRulePackToWorkspace(workspace);
  const snapshots = await new RegulatorySourceCenter([]).listSourceSnapshots();

  console.log(JSON.stringify({
    activePackVersion: activePack.version,
    activeMappingCount: activePack.vendorMappings.length,
    applicationStatus: application.application.status,
    affectedTransactionCount: application.impact.affectedTransactionCount,
    sourceSnapshots: snapshots.length,
    seedPackId: pack.id,
  }, null, 2));

  if (activePack.vendorMappings.length < 5) throw new Error("Accounting rule pack did not seed enough vendor mappings.");
  if (application.application.status !== "AUTO_APPLIED") throw new Error("Accounting rule pack was not applied to the workspace.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

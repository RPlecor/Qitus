import {
  AutomationOpportunityCenter,
  type AutomationOpportunity,
  type AutomationOpportunitySource,
} from "../app/modules/automation/automation-opportunity-center.server";

const workspace = {
  company: { id: "company_validation" },
  fiscalYear: { id: "fy_validation", status: "OPEN" },
  user: { id: "user_validation" },
} as never;

let runCount = 0;
const source: AutomationOpportunitySource = {
  sourceKey: "validation",
  async listOpportunities() {
    return [
      opportunity("validation:safe", 1, false),
      opportunity("validation:suggestion", 2, true),
      opportunity("validation:draft", 3, true),
    ];
  },
  async runSafeOpportunity(_workspace, opportunityKey) {
    if (opportunityKey !== "validation:safe") throw new Error("Unexpected opportunity executed.");
    runCount += 1;
    return { message: "safe ok" };
  },
  async explainOpportunity(_workspace, opportunityKey) {
    return (await this.listOpportunities(workspace)).find((item) => item.opportunityKey === opportunityKey) ?? null;
  },
};

const center = new AutomationOpportunityCenter({
  mode: "safe_auto",
  sources: [source],
  activity: { recordActivity: async () => undefined } as never,
  assertMutable: async () => undefined,
});

const result = await center.runSafeAutomations(workspace);
assert(result.completed === 1, "safe_auto must execute exactly one safe opportunity");
assert(result.failed === 0, "safe_auto must not fail");
assert(runCount === 1, "safe_auto must not execute category 2 or 3 opportunities");

console.log("validate:automation-safe ok");

function opportunity(opportunityKey: string, category: 1 | 2 | 3, requiresUserValidation: boolean): AutomationOpportunity {
  return {
    opportunityKey,
    sourceKey: "validation",
    domain: "imports",
    category,
    title: opportunityKey,
    detail: "Validation automation",
    confidence: 1,
    source: "validation",
    expectedEffect: "Validation only",
    reversible: true,
    requiresUserValidation,
    href: "/imports",
    auditEventName: "automation.safe_run_completed",
  };
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

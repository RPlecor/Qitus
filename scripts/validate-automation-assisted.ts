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
    return [opportunity("validation:safe")];
  },
  async runSafeOpportunity() {
    runCount += 1;
    return { message: "should not run" };
  },
  async explainOpportunity(_workspace, opportunityKey) {
    return (await this.listOpportunities(workspace)).find((item) => item.opportunityKey === opportunityKey) ?? null;
  },
};

const center = new AutomationOpportunityCenter({
  mode: "assistive",
  sources: [source],
  activity: { recordActivity: async () => undefined } as never,
  assertMutable: async () => undefined,
});

const opportunities = await center.getOpportunities(workspace);
const result = await center.runSafeAutomations(workspace);

assert(opportunities.length === 1, "assistive mode must expose opportunities");
assert(result.skipped === 1, "assistive mode must skip safe execution");
assert(runCount === 0, "assistive mode must not mutate");

console.log("validate:automation-assisted ok");

function opportunity(opportunityKey: string): AutomationOpportunity {
  return {
    opportunityKey,
    sourceKey: "validation",
    domain: "imports",
    category: 1,
    title: opportunityKey,
    detail: "Validation automation",
    confidence: 1,
    source: "validation",
    expectedEffect: "Validation only",
    reversible: true,
    requiresUserValidation: false,
    href: "/imports",
    auditEventName: "automation.safe_run_completed",
  };
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

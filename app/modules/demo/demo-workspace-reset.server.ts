import {
  DemoDatasetSeeder,
  type DemoWorkspaceState,
} from "./demo-dataset-seeder.server";

export {
  DEMO_DATASETS,
  DemoDatasetSeeder,
  assertLocalDemoEnvironment,
  formatDemoStateDiff,
  getDemoDatasetDefinition,
  getDemoWorkspaceState,
  getExpectedDemoState,
  isLocalDemoDatabase,
  type DemoDatasetDefinition,
  type DemoDatasetId,
  type DemoDatasetSeedResult,
  type DemoWorkspaceState,
} from "./demo-dataset-seeder.server";

export class DemoWorkspaceReset {
  async resetDemoWorkspace(input: { datasetId?: string | null } = {}): Promise<DemoWorkspaceState> {
    const result = await new DemoDatasetSeeder().resetDemoWorkspace(input);
    return result.state;
  }
}

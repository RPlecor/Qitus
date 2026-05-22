import { assertRuntimeConfig, getRuntimeConfig, sanitizedRuntimeConfig, type RuntimeConfig } from "../runtime-config.server";

export type DeploymentRuntimeReport = {
  status: "ready" | "invalid";
  config: ReturnType<typeof sanitizedRuntimeConfig>;
  errors: string[];
};

export class DeploymentRuntimeCenter {
  constructor(private readonly config: RuntimeConfig = getRuntimeConfig()) {}

  getRuntimeReport(): DeploymentRuntimeReport {
    try {
      assertRuntimeConfig(this.config);
      return { status: "ready", config: sanitizedRuntimeConfig(this.config), errors: [] };
    } catch (error) {
      return {
        status: "invalid",
        config: sanitizedRuntimeConfig(this.config),
        errors: error instanceof Error ? error.message.split(". ").filter(Boolean) : ["Configuration runtime invalide."],
      };
    }
  }

  assertReadyForDeployment() {
    assertRuntimeConfig(this.config);
    return this.getRuntimeReport();
  }
}

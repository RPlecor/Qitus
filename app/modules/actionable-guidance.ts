export type ActionableGuidanceTone = "info" | "warning" | "blocking" | "success";

export type ActionableGuidanceAction = {
  label: string;
  href: string;
  method?: "get" | "post";
};

export type ActionableGuidance = {
  title: string;
  message: string;
  tone: ActionableGuidanceTone;
  primaryAction?: ActionableGuidanceAction;
  secondaryAction?: ActionableGuidanceAction;
  source: string;
  entityType?: string;
  entityId?: string;
  blockingCapability?: string;
  isActionRequired: boolean;
};

export function assertActionableGuidance(guidance: ActionableGuidance) {
  if (guidance.isActionRequired && !guidance.primaryAction) {
    throw new Error(`Actionable guidance from ${guidance.source} requires a primary action: ${guidance.title}`);
  }
  return guidance;
}

export function alertClassForGuidanceTone(tone: ActionableGuidanceTone) {
  if (tone === "blocking") return "red";
  if (tone === "warning") return "orange";
  if (tone === "success") return "green";
  return "blue";
}


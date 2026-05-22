import { getDevCompanyWorkspace } from "./company-workspace/company-workspace.server";

export async function getOrCreateDevContext() {
  return getDevCompanyWorkspace();
}

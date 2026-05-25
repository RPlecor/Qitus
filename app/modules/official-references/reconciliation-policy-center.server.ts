import { OfficialReferenceCenter } from "./official-reference-center.server";
import type { ReconciliationReferencePayload } from "./official-reference-data.server";

export class ReconciliationPolicyCenter {
  constructor(private readonly references = new OfficialReferenceCenter()) {}

  async getActiveReference() {
    return this.references.getActiveReferenceAsync<ReconciliationReferencePayload>("reconciliation");
  }

  async getAccounts() {
    return (await this.getActiveReference()).payloadJson.accounts;
  }

  async getTolerances() {
    return (await this.getActiveReference()).payloadJson.tolerances;
  }

  async isThirdPartyAccount(accountNumber: string | null | undefined) {
    if (!accountNumber) return false;
    return (await this.getAccounts()).thirdPartyPrefixes.some((prefix) => accountNumber.startsWith(prefix));
  }

  async isExactAmountDifference(amount: number) {
    return Math.abs(amount) <= (await this.getTolerances()).exactAmountEpsilon;
  }
}

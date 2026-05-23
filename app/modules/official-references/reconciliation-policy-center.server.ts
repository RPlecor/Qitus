import { OfficialReferenceCenter } from "./official-reference-center.server";
import type { ReconciliationReferencePayload } from "./official-reference-data.server";

export class ReconciliationPolicyCenter {
  constructor(private readonly references = new OfficialReferenceCenter()) {}

  getActiveReference() {
    return this.references.getActiveReference<ReconciliationReferencePayload>("reconciliation");
  }

  getAccounts() {
    return this.getActiveReference().payloadJson.accounts;
  }

  getTolerances() {
    return this.getActiveReference().payloadJson.tolerances;
  }

  isThirdPartyAccount(accountNumber: string | null | undefined) {
    if (!accountNumber) return false;
    return this.getAccounts().thirdPartyPrefixes.some((prefix) => accountNumber.startsWith(prefix));
  }

  isExactAmountDifference(amount: number) {
    return Math.abs(amount) <= this.getTolerances().exactAmountEpsilon;
  }
}

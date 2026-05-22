import { describe, expect, it } from "vitest";
import { writeJournalEntries } from "../app/modules/ledger/ledger-writer";

describe("LedgerWriter", () => {
  it("creates balanced double-entry records", () => {
    const entries = writeJournalEntries({
      transactions: [{
        id: "txn_001",
        date: "2025-01-03",
        label: "OVH",
        normalizedLabel: "ovh",
        counterparty: "OVH SAS",
        amount: -29.99,
        currency: "EUR",
        type: "DEBIT",
      }],
      categorizations: [{
        transactionId: "txn_001",
        accountDebit: "6135",
        accountCredit: "5121",
        journal: "BQ",
        ecritureLabel: "OVH - hosting",
        confidence: "HIGH",
        source: "VENDOR_LOOKUP",
      }],
    });

    expect(entries).toHaveLength(1);
    expect(entries[0].lines.reduce((sum, line) => sum + line.debit, 0)).toBe(29.99);
    expect(entries[0].lines.reduce((sum, line) => sum + line.credit, 0)).toBe(29.99);
  });
});

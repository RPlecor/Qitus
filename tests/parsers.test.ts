import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { detectCsv, parseBankCsv } from "../app/modules/import-pipeline/parsers";

const fixtures = path.join(process.cwd(), "fixtures", "bank-imports");

describe("bank CSV parsers", () => {
  it("detects and parses Qonto CSV", () => {
    const content = readFileSync(path.join(fixtures, "qonto-export-2025.csv"), "utf8");
    const parsed = parseBankCsv({ content });
    expect(parsed.detection.format).toBe("qonto");
    expect(parsed.transactions[0]).toMatchObject({
      sourceId: "QTO-2025-001",
      amount: -29.99,
      type: "DEBIT",
      counterparty: "OVH SAS",
    });
  });

  it("detects known bank formats", () => {
    expect(detectCsv(readFileSync(path.join(fixtures, "bnp-export-2025.csv"), "utf8")).format).toBe("bnp");
    expect(detectCsv(readFileSync(path.join(fixtures, "sg-export-2025.csv"), "utf8")).format).toBe("sg");
    expect(detectCsv(readFileSync(path.join(fixtures, "boursorama-export-2025.csv"), "utf8")).format).toBe("boursorama");
  });

  it("puts unknown CSVs into mapping mode, then parses them with a full mapping", () => {
    const content = "Date,Description,Montant,Tiers,Ref,Id,Categorie\n2025-04-01,Frais outil,-12.50,Notion,INV-1,GEN-1,SaaS\n";
    const unmapped = parseBankCsv({ content });
    expect(unmapped.detection).toMatchObject({ format: "generic", needsMapping: true });
    expect(unmapped.rowCount).toBe(1);
    expect(unmapped.transactions).toEqual([]);

    const mapped = parseBankCsv({
      content,
      mapping: {
        date: "Date",
        label: "Description",
        amount: "Montant",
        counterparty: "Tiers",
        sourceRef: "Ref",
        sourceId: "Id",
        sourceCategory: "Categorie",
      },
    });

    expect(mapped.transactions[0]).toMatchObject({
      sourceId: "GEN-1",
      label: "Frais outil",
      counterparty: "Notion",
      amount: -12.5,
      sourceRef: "INV-1",
      sourceCategory: "SaaS",
    });
  });
});

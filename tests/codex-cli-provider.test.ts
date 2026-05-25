import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { CodexCliCategorizationAdapter, parseCodexJsonlOutput } from "../app/modules/categorization/codex-cli-provider";

describe("CodexCliCategorizationAdapter", () => {
  it("runs Codex with a structured output schema and maps the result", async () => {
    const provider = new CodexCliCategorizationAdapter({
      model: "gpt-test",
      runner: async ({ schemaPath, outputPath, prompt, model }) => {
        const schema = JSON.parse(await readFile(schemaPath, "utf8"));
        expect(model).toBe("gpt-test");
        expect(schema.required).toContain("categorizations");
        expect(prompt).toContain("Plan Comptable General");
        await readFile(outputPath).catch(() => undefined);
        return JSON.stringify({
          categorizations: [
            {
              transactionId: "txn_1",
              accountDebit: "6135",
              accountCredit: "5121",
              journal: "BQ",
              ecritureLabel: "OVH - hosting",
              confidence: "HIGH",
            },
          ],
        });
      },
    });

    const result = await provider.categorize(
      [
        {
          id: "txn_1",
          date: "2025-01-03",
          label: "OVH CLOUD HOSTING",
          normalizedLabel: "ovh cloud hosting",
          amount: -29.99,
          currency: "EUR",
          type: "DEBIT",
        },
      ],
      {
        companyName: "ACME",
        legalForm: "SASU",
        vatRegime: "FRANCHISE",
        accountRoles: {
          bank: { account: "5121", label: "Banque" },
          suspense: { account: "471", label: "Compte d'attente" },
        },
        correctionRules: [],
        vendorMappings: [],
      }
    );

    expect(result[0]).toMatchObject({
      transactionId: "txn_1",
      accountDebit: "6135",
      accountCredit: "5121",
      source: "AI",
    });
  });

  it("extracts the final agent message from Codex JSONL output", () => {
    const output = [
      "non-json warning",
      JSON.stringify({ type: "thread.started", thread_id: "t_1" }),
      JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "{\"categorizations\":[]}" } }),
    ].join("\n");

    expect(parseCodexJsonlOutput(output)).toBe("{\"categorizations\":[]}");
  });
});

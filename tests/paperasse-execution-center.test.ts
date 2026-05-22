import { describe, expect, it } from "vitest";
import { PaperasseExecutionCenter, PaperasseExecutionError } from "../app/modules/paperasse/paperasse-execution-center";
import { PaperasseScriptError } from "../app/modules/paperasse/paperasse-runtime";

describe("PaperasseExecutionCenter", () => {
  it("returns structured script execution metadata", async () => {
    const runtime = {
      async runScript() {
        return {
          script: "generate-fec.js",
          exitCode: 0,
          stdout: "ok",
          stderr: "",
          timedOut: false,
          timeoutMs: 60_000,
          scriptVersion: "abc123",
        };
      },
    };
    const center = new PaperasseExecutionCenter(runtime as never);
    const result = await center.runDocumentScript({ path: "/tmp/x", outputPath: "/tmp/x/output", scriptVersion: "abc123", results: [] }, "fec");
    expect(result).toMatchObject({
      script: "generate-fec.js",
      args: ["--output", "/tmp/x/output"],
      exitCode: 0,
      stdout: "ok",
      userMessage: "Le script Qitus generate-fec.js s'est terminé correctement.",
    });
    expect(result.startedAt).toBeTruthy();
    expect(result.finishedAt).toBeTruthy();
  });

  it("wraps script failures with the structured failed result", async () => {
    const runtime = {
      async runScript() {
        throw new PaperasseScriptError("Le script Qitus generate-fec.js a échoué : boom", {
          script: "generate-fec.js",
          exitCode: 1,
          stdout: "",
          stderr: "boom",
          timedOut: false,
          timeoutMs: 60_000,
          scriptVersion: "abc123",
        });
      },
    };
    const center = new PaperasseExecutionCenter(runtime as never);
    await expect(center.runDocumentScript({ path: "/tmp/x", outputPath: "/tmp/x/output", scriptVersion: "abc123", results: [] }, "fec"))
      .rejects.toBeInstanceOf(PaperasseExecutionError);
  });
});

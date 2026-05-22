import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Render blueprint", () => {
  it("seeds deterministic vendor mappings before starting staging", () => {
    const blueprint = readFileSync(path.join(process.cwd(), "render.yaml"), "utf8");

    expect(blueprint).toContain("npx prisma migrate deploy");
    expect(blueprint).toContain("npm run seed");
    expect(blueprint).toMatch(/startCommand:.*npx prisma migrate deploy.*npm run seed.*npm start/);
  });
});

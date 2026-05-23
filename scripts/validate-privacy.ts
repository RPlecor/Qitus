import { existsSync, readFileSync } from "node:fs";

function assert(condition: unknown, message: string) {
  if (!condition) {
    console.error(`validate:privacy failed: ${message}`);
    process.exit(1);
  }
}

function read(path: string) {
  assert(existsSync(path), `${path} is missing`);
  return readFileSync(path, "utf8");
}

const roadmap = read("ROADMAP.md");
const cadrage = read("docs/cadrage-rgpd-qitus.md");
const privacyPage = read("app/routes/privacy.tsx");
const signup = read("app/routes/signup.tsx");
const login = read("app/routes/login.tsx");
const onboarding = read("app/routes/onboarding.tsx");

assert(roadmap.includes("Sous-roadmap RGPD beta"), "ROADMAP.md must contain the RGPD sub-roadmap");
assert(cadrage.includes("Focus Clerk"), "RGPD cadrage must include Clerk transfer assessment");
assert(cadrage.includes("Clever Cloud"), "RGPD cadrage must include Clever Cloud beta target");
assert(privacyPage.includes("Politique de confidentialité Qitus"), "/privacy page must be user-facing");
assert(signup.includes("/privacy"), "/signup must link to privacy");
assert(login.includes("/privacy"), "/login must link to privacy");
assert(onboarding.includes("/privacy"), "/onboarding must link to privacy");

console.log("validate:privacy ok");

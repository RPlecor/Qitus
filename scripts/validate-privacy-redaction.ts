import { redactSensitive } from "../app/modules/deployment/security-hardening-center.server";

function assert(condition: unknown, message: string) {
  if (!condition) {
    console.error(`validate:privacy-redaction failed: ${message}`);
    process.exit(1);
  }
}

const payload = {
  apiToken: "abc-token",
  nested: {
    message: "IBAN FR1420041010050500013M02606",
    authorization: "Bearer very-secret-token",
  },
};

const serialized = JSON.stringify(redactSensitive(payload));
assert(!serialized.includes("abc-token"), "token value leaked");
assert(!serialized.includes("very-secret-token"), "bearer token leaked");
assert(!serialized.includes("FR1420041010050500013M02606"), "full IBAN leaked");

console.log("validate:privacy-redaction ok");

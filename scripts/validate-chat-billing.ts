const baseUrl = process.env.MVP_BASE_URL ?? "http://localhost:5173";
const allowLiveChat = process.env.LIVE_CHAT_TESTS === "1";

type Check = {
  name: string;
  run: () => Promise<void>;
};

async function main() {
  const checks: Check[] = [
    { name: "GET /chat", run: () => expectPage("/chat", "Chat comptable") },
    { name: "GET /abonnement", run: () => expectPage("/abonnement", "Abonnement") },
    { name: "GET /api/subscription", run: () => expectJson("/api/subscription", ["tier", "status", "limits"]) },
    { name: "GET /api/usage", run: () => expectJson("/api/usage", ["periodKey", "usage", "remaining", "rateLimit"]) },
    { name: "GET /api/billing/status", run: () => expectJson("/api/billing/status", ["mode", "subscription", "entitlements", "stripeReadiness"]) },
    { name: "GET /api/chat/readiness", run: expectChatReadiness },
    { name: "POST /api/chat/message", run: expectChatMessage },
  ];

  for (const check of checks) {
    await check.run();
    console.log(`✓ ${check.name}`);
  }
}

async function expectPage(path: string, fragment: string) {
  const response = await fetch(`${baseUrl}${path}`);
  const text = await response.text();
  if (!response.ok) throw new Error(`${path} returned ${response.status}: ${text.slice(0, 300)}`);
  if (!text.includes(fragment)) throw new Error(`${path} does not contain ${fragment}`);
}

async function expectJson(path: string, keys: string[]) {
  const response = await fetch(`${baseUrl}${path}`, { headers: { Accept: "application/json" } });
  const json = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(`${path} returned ${response.status}: ${JSON.stringify(json)}`);
  for (const key of keys) {
    if (!(key in json)) throw new Error(`${path} response is missing ${key}`);
  }
}

async function expectChatReadiness() {
  const readiness = await getJson<{ provider: string; readOnly: boolean; canUseChat: boolean }>("/api/chat/readiness");
  if (!readiness.readOnly) throw new Error("Chat readiness must be read-only.");
  if (!readiness.canUseChat) throw new Error("Chat is not currently usable. Check /abonnement quotas.");
}

async function expectChatMessage() {
  const readiness = await getJson<{ provider: string }>("/api/chat/readiness");
  if (readiness.provider !== "fake" && !allowLiveChat) {
    console.log("↷ POST /api/chat/message skipped: launch server with CHAT_PROVIDER=fake or set LIVE_CHAT_TESTS=1.");
    return;
  }
  const response = await fetch(`${baseUrl}/api/chat/message`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message: "Pourquoi la clôture est bloquée ?" }),
  });
  const json = await response.json() as { assistantMessage?: { content?: string }; error?: string };
  if (!response.ok) throw new Error(`/api/chat/message returned ${response.status}: ${JSON.stringify(json)}`);
  if (!json.assistantMessage?.content?.includes("lecture seule")) {
    throw new Error("Chat reply does not mention read-only behavior.");
  }
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, { headers: { Accept: "application/json" } });
  const json = await response.json() as T;
  if (!response.ok) throw new Error(`${path} returned ${response.status}: ${JSON.stringify(json)}`);
  return json;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

export {};

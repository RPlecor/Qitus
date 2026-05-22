import { createHmac } from "node:crypto";
import { ExpectedRouteError } from "../route-errors.server";

export function addDays(days: number) {
  return new Date(Date.now() + days * 86_400_000);
}

export function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return result === 0;
}

export function maskIban(iban?: string | null) {
  if (!iban) return undefined;
  if (iban.length <= 8) return `${iban.slice(0, 2)}****`;
  return `${iban.slice(0, 4)}************${iban.slice(-4)}`;
}

export function fallbackTransactionId(provider: string, date: string | undefined, amount: number, label: string) {
  return createHmac("sha256", `qitus-${provider}`).update(`${date ?? ""}|${amount}|${label}`).digest("hex").slice(0, 24);
}

export function redactProviderSecrets(value: string) {
  return value
    .replace(/secret[_-]?(id|key)?["']?\s*[:=]\s*["']?[^"',\s}]+/gi, "secret:[redacted]")
    .replace(/client[_-]?secret["']?\s*[:=]\s*["']?[^"',\s}]+/gi, "client_secret:[redacted]")
    .replace(/access[_-]?token["']?\s*[:=]\s*["']?[^"',\s}]+/gi, "access_token:[redacted]")
    .replace(/auth[_-]?token["']?\s*[:=]\s*["']?[^"',\s}]+/gi, "auth_token:[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+/g, "Bearer [redacted]");
}

export async function parseJsonResponse<T>(response: Response, providerLabel: string, allowEmpty = false): Promise<T> {
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const message = redactProviderSecrets(body || response.statusText);
    throw new ExpectedRouteError(`${providerLabel} a répondu ${response.status} : ${message}`, response.status >= 500 ? 502 : response.status);
  }
  if (allowEmpty || response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

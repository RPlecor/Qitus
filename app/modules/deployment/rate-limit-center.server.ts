import { ExpectedRouteError } from "../route-errors.server";

type Hit = { count: number; resetAt: number };
const buckets = new Map<string, Hit>();

export class RateLimitCenter {
  assertAllowed(input: { key: string; limit: number; windowMs: number; label?: string }) {
    const now = Date.now();
    const bucket = buckets.get(input.key);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(input.key, { count: 1, resetAt: now + input.windowMs });
      return { remaining: input.limit - 1, resetAt: new Date(now + input.windowMs).toISOString() };
    }
    if (bucket.count >= input.limit) {
      throw new ExpectedRouteError(`${input.label ?? "Action"} temporairement limitée. Réessaie dans quelques instants.`, 429);
    }
    bucket.count += 1;
    return { remaining: input.limit - bucket.count, resetAt: new Date(bucket.resetAt).toISOString() };
  }
}

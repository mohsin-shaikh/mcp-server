import type { MiddlewareHandler } from "hono";

type RateBucket = {
  count: number;
  resetAt: number;
};

export function createRateLimiter(rpm: number): MiddlewareHandler {
  const windowMs = 60_000;
  const buckets = new Map<string, RateBucket>();

  return async (c, next) => {
    const forwarded = c.req.header("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() ?? c.req.header("x-real-ip") ?? "unknown";
    const now = Date.now();

    let bucket = buckets.get(ip);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(ip, bucket);
    }

    bucket.count += 1;
    if (bucket.count > rpm) {
      return c.json({ error: "Rate limit exceeded" }, 429);
    }

    await next();
  };
}

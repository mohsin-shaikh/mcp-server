import type { MiddlewareHandler } from "hono";

export function createAuthMiddleware(apiKey?: string): MiddlewareHandler {
  return async (c, next) => {
    if (!apiKey) {
      await next();
      return;
    }

    const auth = c.req.header("Authorization");
    if (auth !== `Bearer ${apiKey}`) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    await next();
  };
}

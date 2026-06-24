import { createMiddleware } from "hono/factory";
import type { ServerConfig } from "../config.js";
import { validateApiKeyHeader } from "./auth.js";

export function createHttpAuthMiddleware(config: ServerConfig) {
  return createMiddleware(async (c, next) => {
    if (c.req.path === "/health") {
      await next();
      return;
    }

    if (config.authMode === "none") {
      await next();
      return;
    }

    const headers: Record<string, string | undefined> = {};
    c.req.raw.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    if (!validateApiKeyHeader(config, headers)) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    await next();
  });
}

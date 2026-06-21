import type { ServerConfig } from "../config.js";
import type { ServerContext } from "../context.js";

export function validateTransportAuth(config: ServerConfig): void {
  if (config.transport !== "http") {
    return;
  }
  if (config.authMode === "api_key" && !config.apiKey) {
    throw new Error("MCP_API_KEY is required when MCP_AUTH_MODE=api_key");
  }
}

export function validateApiKeyHeader(
  config: ServerConfig,
  headers: Record<string, string | undefined>,
): boolean {
  if (config.authMode === "none") {
    return true;
  }
  if (config.authMode === "api_key") {
    const provided =
      headers["x-api-key"] ??
      headers["X-API-Key"] ??
      headers["authorization"]?.replace(/^Bearer\s+/i, "");
    return provided === config.apiKey;
  }
  if (config.authMode === "bearer") {
    const auth = headers["authorization"] ?? headers["Authorization"];
    return Boolean(auth?.startsWith("Bearer "));
  }
  return false;
}

export function assertToolSecrets(ctx: ServerContext): void {
  void ctx;
}

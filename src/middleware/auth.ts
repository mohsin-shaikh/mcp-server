import type { ServerConfig } from "../config.js";
import type { ServerContext } from "../context.js";

export function validateTransportAuth(config: ServerConfig): void {
  if (config.transport !== "http") {
    return;
  }
  if (
    (config.authMode === "api_key" || config.authMode === "bearer") &&
    !config.apiKey
  ) {
    throw new Error(
      "MCP_API_KEY is required when MCP_AUTH_MODE=api_key or bearer",
    );
  }
}

export function validateApiKeyHeader(
  config: ServerConfig,
  headers: Record<string, string | undefined>,
): boolean {
  if (config.authMode === "none") {
    return true;
  }

  const authorization = headers["authorization"];

  if (config.authMode === "api_key") {
    const provided =
      headers["x-api-key"] ?? authorization?.replace(/^bearer\s+/i, "");
    return Boolean(provided && provided === config.apiKey);
  }

  if (config.authMode === "bearer") {
    const token = authorization?.replace(/^bearer\s+/i, "");
    return Boolean(token && token === config.apiKey);
  }

  return false;
}

export function assertToolSecrets(ctx: ServerContext): void {
  void ctx;
}

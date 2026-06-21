import { randomUUID } from "node:crypto";
import type { ServerConfig } from "./config.js";
import type { Logger } from "./lib/logger.js";

export class SecretsStore {
  get(key: string): string | undefined {
    return process.env[key];
  }

  require(key: string): string {
    const value = this.get(key);
    if (!value) {
      throw new Error(`Missing required secret: ${key}`);
    }
    return value;
  }
}

export interface HttpClient {
  fetch: typeof globalThis.fetch;
}

export interface ServerContext {
  config: ServerConfig;
  logger: Logger;
  secrets: SecretsStore;
  http: HttpClient;
  requestId: string;
  isHostAllowed: (url: string) => boolean;
}

function hostMatches(hostname: string, allowed: string): boolean {
  const normalized = allowed.toLowerCase();
  const host = hostname.toLowerCase();
  if (normalized.startsWith("*.")) {
    const suffix = normalized.slice(1);
    return host.endsWith(suffix) || host === normalized.slice(2);
  }
  return host === normalized;
}

export function createHostAllowlistChecker(allowedHosts: string[]) {
  return (url: string): boolean => {
    if (allowedHosts.length === 0) {
      return false;
    }
    try {
      const { hostname } = new URL(url);
      return allowedHosts.some((allowed) => hostMatches(hostname, allowed));
    } catch {
      return false;
    }
  };
}

export function createContext(
  config: ServerConfig,
  logger: Logger,
  requestId = randomUUID(),
): ServerContext {
  return {
    config,
    logger,
    secrets: new SecretsStore(),
    http: { fetch: globalThis.fetch.bind(globalThis) },
    requestId,
    isHostAllowed: createHostAllowlistChecker(config.httpAllowedHosts),
  };
}

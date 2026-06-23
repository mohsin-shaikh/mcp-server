import { parseArgs } from "node:util";
import { parseCommaList } from "./lib/format.js";

export type Transport = "stdio" | "http";
export type AuthMode = "none" | "api_key" | "bearer";
export type LogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace";

export interface ServerConfig {
  serverName: string;
  serverVersion: string;
  transport: Transport;
  httpPort: number;
  httpBindHost: string;
  httpPath: string;
  httpHostAllowlist: string[];
  corsOrigins: string[];
  modules: string[];
  readOnly: boolean;
  logLevel: LogLevel;
  authMode: AuthMode;
  apiKey: string | undefined;
  httpAllowedHosts: string[];
  httpMaxBytes: number;
  httpTimeoutMs: number;
  fsRoot: string | undefined;
  fsMaxReadBytes: number;
}

const DEFAULT_MODULES = ["meta", "http", "json", "datetime", "docs"];

function envBool(key: string, fallback: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) {
    return fallback;
  }
  return value === "true" || value === "1";
}

function envInt(key: string, fallback: number): number {
  const value = process.env[key];
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseModules(value: string | undefined): string[] {
  if (!value?.trim()) {
    return DEFAULT_MODULES;
  }
  if (value.trim() === "*") {
    return ["*"];
  }
  return parseCommaList(value);
}

function parseLogLevel(value: string | undefined): LogLevel {
  const allowed: LogLevel[] = [
    "fatal",
    "error",
    "warn",
    "info",
    "debug",
    "trace",
  ];
  if (value && allowed.includes(value as LogLevel)) {
    return value as LogLevel;
  }
  return "info";
}

function parseTransport(value: string | undefined): Transport {
  return value === "http" ? "http" : "stdio";
}

function parseAuthMode(value: string | undefined): AuthMode {
  if (value === "api_key" || value === "bearer") {
    return value;
  }
  return "none";
}

export function loadConfigFromEnv(): ServerConfig {
  return {
    serverName: process.env["MCP_SERVER_NAME"] ?? "mcp-server",
    serverVersion: process.env["MCP_SERVER_VERSION"] ?? "0.1.0",
    transport: parseTransport(process.env["MCP_TRANSPORT"]),
    httpPort: envInt("MCP_HTTP_PORT", 3100),
    httpBindHost: process.env["MCP_HTTP_HOST"] ?? "127.0.0.1",
    httpPath: process.env["MCP_HTTP_PATH"] ?? "/mcp",
    httpHostAllowlist: parseCommaList(
      process.env["MCP_HTTP_ALLOWED_HOSTS"] ?? "localhost,127.0.0.1,[::1]",
    ),
    corsOrigins: parseCommaList(process.env["MCP_CORS_ORIGINS"]),
    modules: parseModules(process.env["MCP_MODULES"]),
    readOnly: envBool("READ_ONLY", false),
    logLevel: parseLogLevel(process.env["LOG_LEVEL"]),
    authMode: parseAuthMode(process.env["MCP_AUTH_MODE"]),
    apiKey: process.env["MCP_API_KEY"],
    httpAllowedHosts: parseCommaList(process.env["HTTP_TOOL_ALLOWED_HOSTS"]),
    httpMaxBytes: envInt("HTTP_TOOL_MAX_RESPONSE_BYTES", 1_048_576),
    httpTimeoutMs: envInt("HTTP_TOOL_TIMEOUT_MS", 10_000),
    fsRoot: process.env["FS_ROOT"],
    fsMaxReadBytes: envInt("FS_MAX_READ_BYTES", 1_048_576),
  };
}

export function parseCliArgs(argv: string[]): Partial<ServerConfig> {
  const { values } = parseArgs({
    args: argv,
    options: {
      transport: { type: "string" },
      port: { type: "string" },
      modules: { type: "string" },
      "read-only": { type: "boolean" },
      auth: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: false,
    strict: false,
  });

  const overrides: Partial<ServerConfig> = {};

  if (typeof values.transport === "string") {
    overrides.transport = parseTransport(values.transport);
  }
  if (typeof values.port === "string") {
    overrides.httpPort = Number.parseInt(values.port, 10);
  }
  if (typeof values.modules === "string") {
    overrides.modules = parseModules(values.modules);
  }
  if (values["read-only"]) {
    overrides.readOnly = true;
  }
  if (typeof values.auth === "string") {
    overrides.authMode = parseAuthMode(values.auth);
  }

  return overrides;
}

export function mergeConfig(
  base: ServerConfig,
  overrides: Partial<ServerConfig>,
): ServerConfig {
  return { ...base, ...overrides };
}

export function loadConfig(argv = process.argv.slice(2)): ServerConfig {
  return mergeConfig(loadConfigFromEnv(), parseCliArgs(argv));
}

export function configSummary(config: ServerConfig): Record<string, unknown> {
  return {
    serverName: config.serverName,
    serverVersion: config.serverVersion,
    transport: config.transport,
    httpPort: config.httpPort,
    httpBindHost: config.httpBindHost,
    httpPath: config.httpPath,
    modules: config.modules,
    readOnly: config.readOnly,
    authMode: config.authMode,
    httpAllowedHosts: config.httpAllowedHosts,
    httpMaxBytes: config.httpMaxBytes,
    httpTimeoutMs: config.httpTimeoutMs,
    fsRootConfigured: Boolean(config.fsRoot),
    fsMaxReadBytes: config.fsMaxReadBytes,
  };
}

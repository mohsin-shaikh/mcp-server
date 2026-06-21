export function getConfigJsonSchema(): Record<string, unknown> {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "McpServerConfig",
    type: "object",
    properties: {
      MCP_SERVER_NAME: {
        type: "string",
        default: "mcp-server",
        description: "Server display name",
      },
      MCP_SERVER_VERSION: {
        type: "string",
        default: "0.1.0",
        description: "Server version string",
      },
      MCP_TRANSPORT: {
        type: "string",
        enum: ["stdio", "http"],
        default: "stdio",
      },
      MCP_HTTP_PORT: {
        type: "integer",
        default: 3100,
      },
      MCP_MODULES: {
        type: "string",
        default: "meta,http,json,datetime,docs",
        description: "Comma-separated module ids, or * for all built-in (except filesystem)",
      },
      READ_ONLY: {
        type: "boolean",
        default: false,
        description: "Skip mutating modules and tools",
      },
      LOG_LEVEL: {
        type: "string",
        enum: ["fatal", "error", "warn", "info", "debug", "trace"],
        default: "info",
      },
      MCP_AUTH_MODE: {
        type: "string",
        enum: ["none", "api_key", "bearer"],
        default: "none",
      },
      MCP_API_KEY: {
        type: "string",
        description: "Required when MCP_AUTH_MODE=api_key",
      },
      HTTP_TOOL_ALLOWED_HOSTS: {
        type: "string",
        description: "Comma-separated hostnames; empty means deny-all",
      },
      HTTP_TOOL_MAX_RESPONSE_BYTES: {
        type: "integer",
        default: 1048576,
      },
      HTTP_TOOL_TIMEOUT_MS: {
        type: "integer",
        default: 10000,
      },
      FS_ROOT: {
        type: "string",
        description: "Sandbox root for filesystem module (required to enable it)",
      },
      FS_MAX_READ_BYTES: {
        type: "integer",
        default: 1048576,
        description: "Max bytes read per file",
      },
    },
  };
}

import {
  Client,
  StdioClientTransport,
  StreamableHTTPClientTransport,
  type Transport,
} from "@modelcontextprotocol/client";
import { healthUrlFromMcpUrl } from "./namespace.js";
import type { McpHttpServerConfig, McpServerConfig, McpStdioServerConfig } from "./types.js";

const CLIENT_NAME = "zuupee-mcp-client";
const CLIENT_VERSION = "0.1.0";

interface ServerConnection {
  config: McpServerConfig;
  client: Client;
  transport: Transport;
}

function isHttpConfig(config: McpServerConfig): config is McpHttpServerConfig {
  return config.transport === "http";
}

function isStdioConfig(config: McpServerConfig): config is McpStdioServerConfig {
  return config.transport === "stdio";
}

function createTransport(config: McpServerConfig): Transport {
  if (isStdioConfig(config)) {
    return new StdioClientTransport({
      command: config.command,
      args: config.args,
      env: config.env,
      stderr: "pipe",
    });
  }

  const headers: Record<string, string> = {};
  if (config.apiKey) {
    headers["X-API-Key"] = config.apiKey;
  }

  return new StreamableHTTPClientTransport(new URL(config.url), {
    requestInit: Object.keys(headers).length > 0 ? { headers } : undefined,
  });
}

async function closeTransport(transport: Transport): Promise<void> {
  if (transport instanceof StreamableHTTPClientTransport) {
    try {
      await transport.terminateSession();
    } catch {
      // Session may already be closed.
    }
  }

  await transport.close();
}

export class McpConnectionManager {
  private readonly connections = new Map<string, ServerConnection>();
  private connected = false;

  constructor(private readonly servers: McpServerConfig[]) {
    const ids = new Set<string>();
    for (const server of servers) {
      if (ids.has(server.id)) {
        throw new Error(`Duplicate MCP server id "${server.id}"`);
      }
      ids.add(server.id);
    }
  }

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    await Promise.all(
      this.servers.map(async (config) => {
        const client = new Client({ name: CLIENT_NAME, version: CLIENT_VERSION });
        const transport = createTransport(config);
        await client.connect(transport);
        this.connections.set(config.id, { config, client, transport });
      }),
    );

    this.connected = true;
  }

  async close(): Promise<void> {
    const closing = [...this.connections.values()].map(async ({ client, transport }) => {
      await client.close();
      await closeTransport(transport);
    });

    await Promise.all(closing);
    this.connections.clear();
    this.connected = false;
  }

  getClient(serverId: string): Client {
    const connection = this.connections.get(serverId);
    if (!connection) {
      throw new Error(`MCP server "${serverId}" is not connected`);
    }
    return connection.client;
  }

  getServerIds(): string[] {
    return [...this.connections.keys()];
  }

  async healthCheck(): Promise<Record<string, "ok" | "error">> {
    const results: Record<string, "ok" | "error"> = {};

    await Promise.all(
      [...this.connections.entries()].map(async ([serverId, { config, client }]) => {
        try {
          if (isHttpConfig(config)) {
            const healthUrl = healthUrlFromMcpUrl(config.url);
            const headers: Record<string, string> = {};
            if (config.apiKey) {
              headers["X-API-Key"] = config.apiKey;
            }

            const response = await fetch(healthUrl, { headers });
            results[serverId] = response.ok ? "ok" : "error";
            return;
          }

          await client.ping();
          results[serverId] = "ok";
        } catch {
          results[serverId] = "error";
        }
      }),
    );

    return results;
  }
}

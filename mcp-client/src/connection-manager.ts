import {
  Client,
  StdioClientTransport,
  StreamableHTTPClientTransport,
  type Transport,
} from "@modelcontextprotocol/client";
import { CircuitBreaker } from "./circuit-breaker.js";
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

async function closeConnection(connection: ServerConnection): Promise<void> {
  await connection.client.close();
  await closeTransport(connection.transport);
}

export class McpConnectionManager {
  private readonly connections = new Map<string, ServerConnection>();
  private readonly circuits = new Map<string, CircuitBreaker>();

  constructor(private readonly servers: McpServerConfig[]) {
    const ids = new Set<string>();
    for (const server of servers) {
      if (ids.has(server.id)) {
        throw new Error(`Duplicate MCP server id "${server.id}"`);
      }
      ids.add(server.id);
      this.circuits.set(server.id, new CircuitBreaker());
    }
  }

  async connect(): Promise<void> {
    await Promise.all(this.servers.map((config) => this.connectServer(config)));
  }

  async close(): Promise<void> {
    const closing = [...this.connections.values()].map((connection) => closeConnection(connection));
    await Promise.all(closing);
    this.connections.clear();
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

  getCircuitState(serverId: string): "closed" | "open" | "half-open" | undefined {
    return this.circuits.get(serverId)?.getState();
  }

  async ensureServer(serverId: string): Promise<void> {
    const circuit = this.circuits.get(serverId);
    if (!circuit) {
      throw new Error(`Unknown MCP server "${serverId}"`);
    }

    if (!circuit.canAttempt()) {
      throw new Error(`MCP server "${serverId}" is temporarily unavailable (circuit open)`);
    }

    if (!this.connections.has(serverId)) {
      const config = this.servers.find((server) => server.id === serverId);
      if (!config) {
        throw new Error(`Unknown MCP server "${serverId}"`);
      }
      await this.connectServer(config);
      return;
    }

    try {
      await this.pingServer(serverId);
      circuit.recordSuccess();
    } catch {
      circuit.recordFailure();
      await this.reconnectServer(serverId);
    }
  }

  async reconnectServer(serverId: string): Promise<void> {
    const existing = this.connections.get(serverId);
    if (existing) {
      await closeConnection(existing);
      this.connections.delete(serverId);
    }

    const config = this.servers.find((server) => server.id === serverId);
    if (!config) {
      throw new Error(`Unknown MCP server "${serverId}"`);
    }

    await this.connectServer(config);
  }

  async healthCheck(): Promise<Record<string, "ok" | "error">> {
    const results: Record<string, "ok" | "error"> = {};

    await Promise.all(
      this.servers.map(async (config) => {
        const circuit = this.circuits.get(config.id);
        if (!circuit?.canAttempt()) {
          results[config.id] = "error";
          return;
        }

        try {
          if (!this.connections.has(config.id)) {
            await this.connectServer(config);
          } else {
            await this.pingServer(config.id);
          }
          circuit.recordSuccess();
          results[config.id] = "ok";
        } catch {
          circuit?.recordFailure();
          results[config.id] = "error";
        }
      }),
    );

    return results;
  }

  private async connectServer(config: McpServerConfig): Promise<void> {
    const circuit = this.circuits.get(config.id);
    if (!circuit?.canAttempt()) {
      throw new Error(`MCP server "${config.id}" is temporarily unavailable (circuit open)`);
    }

    if (this.connections.has(config.id)) {
      return;
    }

    try {
      const client = new Client({ name: CLIENT_NAME, version: CLIENT_VERSION });
      const transport = createTransport(config);
      await client.connect(transport);
      this.connections.set(config.id, { config, client, transport });
      circuit.recordSuccess();
    } catch (err) {
      circuit.recordFailure();
      throw err;
    }
  }

  private async pingServer(serverId: string): Promise<void> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      throw new Error(`MCP server "${serverId}" is not connected`);
    }

    if (isHttpConfig(connection.config)) {
      const healthUrl = healthUrlFromMcpUrl(connection.config.url);
      const headers: Record<string, string> = {};
      if (connection.config.apiKey) {
        headers["X-API-Key"] = connection.config.apiKey;
      }

      const response = await fetch(healthUrl, { headers });
      if (!response.ok) {
        throw new Error(`Health check failed for "${serverId}"`);
      }
      return;
    }

    await connection.client.ping();
  }
}

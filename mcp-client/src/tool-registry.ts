import type { Tool } from "@modelcontextprotocol/client";
import type { McpConnectionManager } from "./connection-manager.js";
import { formatCallToolResult } from "./format-result.js";
import { namespaceTool, parseNamespacedTool } from "./namespace.js";
import { truncateToolResult } from "./truncate.js";
import type {
  McpResourceDefinition,
  McpToolDefinition,
  ToolResult,
} from "./types.js";

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function toToolDefinition(serverId: string, tool: Tool): McpToolDefinition {
  return {
    serverId,
    name: tool.name,
    namespacedName: namespaceTool(serverId, tool.name),
    description: tool.description,
    inputSchema: asRecord(tool.inputSchema),
    annotations: tool.annotations ? asRecord(tool.annotations) : undefined,
  };
}

async function listAllTools(
  client: ReturnType<McpConnectionManager["getClient"]>,
): Promise<Tool[]> {
  const tools: Tool[] = [];
  let cursor: string | undefined;

  do {
    const page = await client.listTools(cursor ? { cursor } : undefined);
    tools.push(...page.tools);
    cursor = page.nextCursor;
  } while (cursor);

  return tools;
}

async function listAllResources(
  client: ReturnType<McpConnectionManager["getClient"]>,
): Promise<McpResourceDefinition[]> {
  const resources: McpResourceDefinition[] = [];
  let cursor: string | undefined;

  do {
    const page = await client.listResources(cursor ? { cursor } : undefined);
    for (const resource of page.resources) {
      resources.push({
        serverId: "",
        uri: resource.uri,
        name: resource.name,
        description: resource.description,
        mimeType: resource.mimeType,
      });
    }
    cursor = page.nextCursor;
  } while (cursor);

  return resources;
}

export class McpToolRegistry {
  private tools: McpToolDefinition[] = [];
  private resources: McpResourceDefinition[] = [];

  constructor(private readonly manager: McpConnectionManager) {}

  async refresh(): Promise<void> {
    const tools: McpToolDefinition[] = [];
    const resources: McpResourceDefinition[] = [];

    for (const serverId of this.manager.getServerIds()) {
      const client = this.manager.getClient(serverId);
      const serverTools = await listAllTools(client);
      tools.push(...serverTools.map((tool) => toToolDefinition(serverId, tool)));

      const serverResources = await listAllResources(client);
      resources.push(
        ...serverResources.map((resource) => ({
          ...resource,
          serverId,
        })),
      );
    }

    this.tools = tools;
    this.resources = resources;
  }

  listTools(): McpToolDefinition[] {
    return [...this.tools];
  }

  listResources(): McpResourceDefinition[] {
    return [...this.resources];
  }

  getServerInstructions(): string {
    const sections: string[] = [];

    for (const serverId of this.manager.getServerIds()) {
      const instructions = this.manager.getClient(serverId).getInstructions();
      if (instructions) {
        sections.push(`## Server: ${serverId}\n${instructions}`);
      }
    }

    return sections.join("\n\n");
  }

  async callTool(
    namespacedName: string,
    args: unknown,
    options?: { maxResultBytes?: number },
  ): Promise<ToolResult> {
    const { serverId, toolName } = parseNamespacedTool(namespacedName);
    const client = this.manager.getClient(serverId);
    const result = await client.callTool({
      name: toolName,
      arguments: asRecord(args),
    });

    const formatted = formatCallToolResult(result);
    return {
      content: truncateToolResult(formatted.text, options?.maxResultBytes),
      isError: formatted.isError,
    };
  }

  async readResource(uri: string, serverId?: string): Promise<string> {
    const targetServerId = serverId ?? this.findServerIdForResource(uri);
    const client = this.manager.getClient(targetServerId);
    const result = await client.readResource({ uri });

    const parts: string[] = [];
    for (const item of result.contents) {
      if ("text" in item && typeof item.text === "string") {
        parts.push(item.text);
      } else {
        parts.push(JSON.stringify(item));
      }
    }

    return parts.join("\n") || "(empty resource)";
  }

  private findServerIdForResource(uri: string): string {
    const match = this.resources.find((resource) => resource.uri === uri);
    if (!match) {
      throw new Error(`No MCP server registered for resource URI "${uri}"`);
    }
    return match.serverId;
  }
}

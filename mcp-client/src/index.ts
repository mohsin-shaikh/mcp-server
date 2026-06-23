import { readFile } from "node:fs/promises";
import type { McpServerConfig } from "./types.js";

export async function loadMcpServersConfig(path: string): Promise<McpServerConfig[]> {
  const raw = await readFile(path, "utf8");
  const parsed = JSON.parse(raw) as { servers?: McpServerConfig[] };

  if (!parsed.servers || !Array.isArray(parsed.servers) || parsed.servers.length === 0) {
    throw new Error(`MCP servers config at "${path}" must include a non-empty "servers" array`);
  }

  return parsed.servers;
}

export { toOpenAITools } from "./adapters/openai.js";
export { McpConnectionManager } from "./connection-manager.js";
export { formatCallToolResult } from "./format-result.js";
export {
  healthUrlFromMcpUrl,
  namespaceTool,
  parseNamespacedTool,
} from "./namespace.js";
export { McpToolRegistry } from "./tool-registry.js";
export { truncateToolResult } from "./truncate.js";
export type {
  McpHttpServerConfig,
  McpResourceDefinition,
  McpServerConfig,
  McpStdioServerConfig,
  McpToolDefinition,
  OpenAIChatCompletionTool,
  ToolResult,
} from "./types.js";

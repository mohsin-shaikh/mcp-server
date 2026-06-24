import type { McpToolDefinition, ToolResult } from "@zuupee/mcp-client";

export interface ToolRegistryLike {
  refresh(): Promise<void>;
  listTools(): McpToolDefinition[];
  getServerInstructions(): string;
  callTool(namespacedName: string, args: unknown): Promise<ToolResult>;
}

export interface ConnectionManagerLike {
  connect(): Promise<void>;
  close(): Promise<void>;
  healthCheck(): Promise<Record<string, "ok" | "error">>;
}
